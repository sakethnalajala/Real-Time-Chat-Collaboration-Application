import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeExtension } from './fileNames.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const LOCAL_UPLOAD_ROOT = path.resolve(process.env.LOCAL_UPLOAD_DIR || path.join(serverRoot, 'uploads'));

/**
 * Development storage: files on the API server's disk, served from /uploads.
 * NOT suitable for Render's free tier in production (its filesystem is ephemeral).
 */
export function createLocalDriver({ publicServerUrl } = {}) {
  return {
    name: 'local',

    async upload(file, { folder, kind }) {
      const safeFolder = String(folder).replace(/[^a-zA-Z0-9/_-]/g, '');
      const fileName = `${crypto.randomUUID()}.${safeExtension(file.originalname, file.mimetype)}`;
      const dir = path.join(LOCAL_UPLOAD_ROOT, safeFolder);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, fileName), file.buffer);
      const relative = `/uploads/${safeFolder}/${fileName}`;
      return {
        url: publicServerUrl ? `${publicServerUrl}${relative}` : relative,
        publicId: `${safeFolder}/${fileName}`,
        provider: 'local',
        resourceType: kind === 'image' ? 'image' : 'raw',
        width: null,
        height: null,
        size: file.size,
      };
    },

    async remove(media) {
      const target = path.resolve(LOCAL_UPLOAD_ROOT, media.publicId);
      if (!target.startsWith(LOCAL_UPLOAD_ROOT + path.sep)) return; // path traversal guard
      await fs.unlink(target).catch(() => {});
    },
  };
}
