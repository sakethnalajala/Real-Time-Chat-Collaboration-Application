/**
 * Seeds the demo accounts (and sample conversations) into the database in MONGODB_URI.
 *
 *   npm run seed          create missing demo accounts + sample chats (idempotent)
 *   npm run seed:reset    also wipe and recreate the demo users' conversations
 *
 * Works against MongoDB Atlas too — run it locally with your Atlas MONGODB_URI in server/.env.
 */
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { ensureDemoAccounts, seedSampleConversations } from '../services/demo.service.js';

const reset = process.argv.includes('--reset');

try {
  await connectDatabase();
  const { accounts, created } = await ensureDemoAccounts({ resetProfiles: reset });
  const seeded = await seedSampleConversations(accounts, { reset });

  console.log('\nDemo accounts ready:');
  for (const account of config.demo.accounts) {
    const user = accounts[account.key];
    console.log(`  ${account.label.padEnd(12)} ${user.email.padEnd(28)} role=${user.role}`);
  }
  console.log(`\n  New accounts: ${created}. Sample conversations ${seeded ? 'created' : 'already present (use --reset to recreate)'}.`);
  if (!config.demo.accounts.every((a) => a.password)) {
    console.log('  Tip: set DEMO_USER_PASSWORD / DEMO_ADMIN_PASSWORD to sign in with email + password as well.');
  }
  console.log('');
} catch (err) {
  console.error('[seed] Failed:', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
