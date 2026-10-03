import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    env: {
      NODE_ENV: 'test',
      BCRYPT_ROUNDS: '4',
      DEMO_MODE: 'false',
      JWT_ACCESS_SECRET: 'test-secret-'.padEnd(64, 'x'),
      REFRESH_REUSE_GRACE_SECONDS: '0',
      STORAGE_DRIVER: 'local',
      LOCAL_UPLOAD_DIR: path.join(os.tmpdir(), 'nebula-chat-test-uploads'),
      MONGOMS_DOWNLOAD_DIR: path.join(os.homedir(), '.cache', 'mongodb-binaries'),
      CLIENT_URL: 'http://localhost:5173',
      SMTP_HOST: '',
    },
  },
});
