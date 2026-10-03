/**
 * Verifies the Cloudinary credentials in server/.env with real uploads, then deletes them.
 *
 *   npm run check:cloudinary      (from /server)
 *
 * Exercises the same driver the app uses for profile pictures and group images (avatar
 * variant), chat images, and chat file attachments. Never prints the API key or secret.
 */
import { config } from '../config/env.js';
import { createCloudinaryDriver } from '../services/storage/cloudinaryDriver.js';

const { hasCloudinary, missingCloudinaryVars, cloudinary } = config.storage;

if (!hasCloudinary) {
  console.error(`\n✗ Missing ${missingCloudinaryVars.join(', ')} in server/.env\n`);
  process.exit(1);
}

// 1×1 PNG and a small text file.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const text = Buffer.from('Nebula Chat storage check');

const checks = [
  { label: 'Profile / group image', file: { buffer: png, originalname: 'check.png', mimetype: 'image/png', size: png.length }, options: { folder: 'diagnostics', kind: 'image', variant: 'avatar' } },
  { label: 'Chat image', file: { buffer: png, originalname: 'check.png', mimetype: 'image/png', size: png.length }, options: { folder: 'diagnostics', kind: 'image' } },
  { label: 'Chat file', file: { buffer: text, originalname: 'check.txt', mimetype: 'text/plain', size: text.length }, options: { folder: 'diagnostics', kind: 'file' } },
];

console.log(`\nChecking Cloudinary cloud "${cloudinary.cloudName}" (folder: ${cloudinary.folder})…\n`);
const driver = createCloudinaryDriver(cloudinary);
const uploaded = [];
let failed = false;

for (const check of checks) {
  try {
    const result = await driver.upload(check.file, check.options);
    uploaded.push(result);
    console.log(`  ✓ ${check.label.padEnd(22)} ${result.url}`);
  } catch (err) {
    failed = true;
    console.error(`  ✗ ${check.label.padEnd(22)} ${err?.message || err?.error?.message || 'upload failed'}`);
  }
}

for (const media of uploaded) {
  await driver.remove(media).catch(() => {});
}
if (uploaded.length) console.log(`\n  Cleaned up ${uploaded.length} test upload(s).`);

if (failed) {
  console.error('\n✗ Cloudinary check failed. Double-check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.\n');
  process.exit(1);
}
console.log('\n✓ Cloudinary is ready — restart the API and uploads will be stored in Cloudinary.\n');
