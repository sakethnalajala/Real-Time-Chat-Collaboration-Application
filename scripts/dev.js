/**
 * One command for local development:  npm run dev  (from the repository root)
 *
 *  1. checks that the MongoDB in server/.env (MONGODB_URI) is reachable — e.g. your local
 *     mongodb://localhost:27017/real_time_chat. (If MONGODB_URI is empty or points at port 27018,
 *     it instead starts the bundled development MongoDB.)
 *  2. starts the API with auto-reload (node --watch)
 *  3. starts the Vite dev server (proxies /api, /uploads and WebSockets to the API)
 *
 * Processes are launched with `node` directly (no npm/.bin shims), so it also works in paths
 * containing spaces or special characters.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');

const COLORS = { db: '\x1b[35m', api: '\x1b[36m', web: '\x1b[32m', dev: '\x1b[33m' };
const RESET = '\x1b[0m';
const log = (name, line) => process.stdout.write(`${COLORS[name] || ''}[${name}]${RESET} ${line}\n`);

for (const [dir, label] of [
  [serverDir, 'server'],
  [clientDir, 'client'],
]) {
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    log('dev', `Dependencies missing in /${label}. Run "npm run install:all" first.`);
    process.exit(1);
  }
}

function readEnvValue(file, key) {
  if (!fs.existsSync(file)) return undefined;
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
}

const envFile = path.join(serverDir, '.env');
if (!fs.existsSync(envFile)) {
  fs.copyFileSync(path.join(serverDir, '.env.example'), envFile);
  log('dev', 'Created server/.env from .env.example — review it when you have a moment.');
}

const mongoUri = readEnvValue(envFile, 'MONGODB_URI') || '';
const devDbPort = Number(readEnvValue(envFile, 'DEV_DB_PORT') || 27018);
const usesLocalDevDb = !mongoUri || new RegExp(`(127\\.0\\.0\\.1|localhost):${devDbPort}`).test(mongoUri);

const children = [];

function start(name, cwd, args) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, FORCE_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach((line) => line.trim() && log(name, line));
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    log(name, `exited with code ${code}`);
    if (!shuttingDown && name !== 'db') shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

async function waitForPort(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 750));
  }
  return false;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('dev', 'Stopping…');
  children.forEach((child) => child.kill());
  setTimeout(() => process.exit(code), 1500).unref();
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (usesLocalDevDb) {
  if (await isPortOpen(devDbPort)) {
    log('db', `Using the bundled development MongoDB already running on port ${devDbPort}`);
  } else {
    start('db', serverDir, ['src/scripts/dev-db.js']);
    log('dev', 'Waiting for the bundled development database (first run downloads MongoDB — be patient)…');
    if (!(await waitForPort(devDbPort, 10 * 60 * 1000))) {
      log('dev', 'The development database did not start. See the [db] output above.');
      shutdown(1);
    }
  }
} else {
  let target = 'remote host';
  try {
    const parsed = new URL(mongoUri.replace(/^mongodb(\+srv)?:/, 'http:'));
    target = `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (isLocal && !(await isPortOpen(Number(parsed.port) || 27017))) {
      log('db', `MongoDB is not reachable at ${target}. Start your local MongoDB service (e.g. "net start MongoDB") and try again.`);
      process.exit(1);
    }
  } catch {
    /* unparsable URI — let the API report the error */
  }
  log('db', `Using MONGODB_URI from server/.env → ${target}`);
}

start('api', serverDir, ['--watch', '--env-file-if-exists=.env', 'src/server.js']);
start('web', clientDir, ['node_modules/vite/bin/vite.js']);
log('dev', 'App → http://localhost:5173   API → http://localhost:5000/api/health   (Ctrl+C to stop)');
