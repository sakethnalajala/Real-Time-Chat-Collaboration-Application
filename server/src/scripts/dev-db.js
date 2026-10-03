/**
 * Local development database.
 *
 * Starts a real `mongod` (downloaded once by mongodb-memory-server) with a persistent data
 * directory outside the repository, so you can develop without installing MongoDB or
 * creating an Atlas cluster first. Not used in production — Render connects to Atlas.
 *
 *   npm run db            (from /server)
 *   npm run dev           (from the repository root — starts it automatically when needed)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.env.DEV_DB_PORT || 27018);
const dbPath = path.resolve(process.env.DEV_DB_PATH || path.join(os.homedir(), '.nebula-chat', 'mongo-data'));

// Keep the downloaded MongoDB binary out of the (possibly cloud-synced) project folder.
process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(os.homedir(), '.cache', 'mongodb-binaries');

fs.mkdirSync(dbPath, { recursive: true });

const { MongoMemoryServer } = await import('mongodb-memory-server');

console.log(`[dev-db] Starting local MongoDB on 127.0.0.1:${port}`);
console.log(`[dev-db] Data directory: ${dbPath}`);
console.log('[dev-db] (first run downloads the MongoDB binary — this can take a minute)');

const server = await MongoMemoryServer.create({
  instance: {
    port,
    ip: '127.0.0.1',
    dbPath,
    storageEngine: 'wiredTiger',
  },
});

console.log(`[dev-db] Ready → ${server.getUri()}`);

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log('\n[dev-db] Stopping local MongoDB…');
  await server.stop({ doCleanup: false, force: false });
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
