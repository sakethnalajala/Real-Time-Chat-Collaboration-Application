import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STRONG_PASSWORD, createUser, startTestServer, stopTestServer, userInput } from './helpers.js';

let app;

beforeAll(async () => {
  ({ app } = await startTestServer());
});

afterAll(async () => {
  await stopTestServer();
});

const refreshCookie = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('nebula_rt='));

describe('Authentication', () => {
  it('rejects invalid registration input with field details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(userInput({ password: 'weak', confirmPassword: 'different' }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toContain('password');
  });

  it('rejects mismatched password confirmation', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(userInput({ confirmPassword: 'Different1!' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d) => d.path === 'confirmPassword')).toBe(true);
  });

  it('registers a user, hashes the password and sets an httpOnly refresh cookie', async () => {
    const input = userInput();
    const res = await request(app).post('/api/auth/register').send(input);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user.email).toBe(input.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.role).toBe('user');
    const cookie = refreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('ignores attempts to self-assign the admin role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...userInput(), role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('returns 409 for duplicate email or username', async () => {
    const input = userInput();
    await request(app).post('/api/auth/register').send(input).expect(201);
    const res = await request(app).post('/api/auth/register').send({ ...userInput(), email: input.email });
    expect(res.status).toBe(409);
    expect(res.body.error.details[0].path).toBe('email');
  });

  it('logs in with valid credentials only', async () => {
    const { user } = await createUser(app);
    const bad = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Wrong123!' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

    const good = await request(app).post('/api/auth/login').send({ email: user.email, password: STRONG_PASSWORD });
    expect(good.status).toBe(200);
    expect(good.body.data.user._id).toBe(user._id);
  });

  it('protects routes with JWT', async () => {
    const { auth } = await createUser(app);
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
    const res = await request(app).get('/api/auth/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBeDefined();
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const { agent } = await createUser(app);
    const first = await agent.post('/api/auth/refresh');
    expect(first.status).toBe(200);
    const oldCookie = refreshCookie(first);

    const second = await agent.post('/api/auth/refresh');
    expect(second.status).toBe(200);

    // Replaying a rotated token → 401 and the whole session family is revoked.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie.split(';')[0]);
    expect(replay.status).toBe(401);
    const afterTheft = await agent.post('/api/auth/refresh');
    expect(afterTheft.status).toBe(401);
  });

  it('logs out by revoking the refresh session', async () => {
    const { agent } = await createUser(app);
    await agent.post('/api/auth/logout').expect(204);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it('changes password and invalidates previously issued access tokens', async () => {
    const { agent, auth, user } = await createUser(app);
    const wrong = await agent
      .patch('/api/auth/change-password')
      .set(auth)
      .send({ currentPassword: 'Nope1234!', newPassword: 'N3wPassword!', confirmPassword: 'N3wPassword!' });
    expect(wrong.status).toBe(400);

    const res = await agent
      .patch('/api/auth/change-password')
      .set(auth)
      .send({ currentPassword: STRONG_PASSWORD, newPassword: 'N3wPassword!', confirmPassword: 'N3wPassword!' });
    expect(res.status).toBe(200);
    const newToken = res.body.data.accessToken;

    const stale = await request(app).get('/api/auth/me').set(auth);
    expect(stale.status).toBe(401);
    expect(stale.body.error.code).toBe('TOKEN_REVOKED');
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${newToken}`).expect(200);

    // The current device keeps its session.
    await agent.post('/api/auth/refresh').expect(200);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'N3wPassword!' }).expect(200);
  });

  it('runs the forgot/reset password flow (development link without SMTP)', async () => {
    const { user, agent } = await createUser(app);

    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.devResetUrl).toBeUndefined();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
    const token = res.body.data.devResetUrl.split('/').pop();

    await request(app).get(`/api/auth/reset-password/${token}`).expect(200);
    await request(app)
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'Res3tPassword!', confirmPassword: 'Res3tPassword!' })
      .expect(200);

    // Single use
    await request(app)
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: 'Another1Pass!', confirmPassword: 'Another1Pass!' })
      .expect(400);

    // Existing sessions were revoked; the new password works.
    await agent.post('/api/auth/refresh').expect(401);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'Res3tPassword!' }).expect(200);
  });

  it('forbids regular users from admin endpoints', async () => {
    const { auth } = await createUser(app);
    const res = await request(app).get('/api/admin/stats').set(auth);
    expect(res.status).toBe(403);
  });

  it('exposes public runtime config without secrets', async () => {
    const res = await request(app).get('/api/config').expect(200);
    expect(res.body.data.uploads.enabled).toBe(true);
    const body = JSON.stringify(res.body);
    // No secret values or credential fields (demo accounts are disabled in tests).
    expect(body).not.toContain(process.env.JWT_ACCESS_SECRET);
    expect(body).not.toMatch(/secret|smtp|api_?key|"password"/i);
  });

  it('lists demo accounts without their passwords and signs them in with one click', async () => {
    const { config } = await import('../src/config/env.js');
    const { ensureDemoAccounts } = await import('../src/services/demo.service.js');
    const original = config.demo;
    const passwords = { user: 'Demo-Pass-4821x', admin: 'Admin-Pass-7395y' };
    config.demo = { ...original, enabled: true, accounts: original.accounts.map((a) => ({ ...a, password: passwords[a.role] })) };
    try {
      await ensureDemoAccounts({ log: false });

      const res = await request(app).get('/api/config').expect(200);
      const { accounts } = res.body.data.demo;
      expect(res.body.data.demo.enabled).toBe(true);
      expect(accounts.map((a) => a.role)).toEqual(expect.arrayContaining(['user', 'admin']));
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/"password"/i);
      expect(body).not.toContain(passwords.user);
      expect(body).not.toContain(passwords.admin);

      for (const account of accounts.filter((a) => a.key === 'user1' || a.key === 'admin')) {
        const login = await request(app).post('/api/auth/demo-login').send({ account: account.key }).expect(200);
        expect(login.body.data.accessToken).toEqual(expect.any(String));
        expect(login.body.data.user.email).toBe(account.email);
        expect(login.body.data.user.role).toBe(account.role);
        expect(refreshCookie(login)).toBeTruthy();
      }

      // The configured password still works with the normal email + password form.
      const admin = accounts.find((a) => a.role === 'admin');
      await request(app).post('/api/auth/login').send({ email: admin.email, password: passwords.admin }).expect(200);
    } finally {
      config.demo = original;
    }
  });
});
