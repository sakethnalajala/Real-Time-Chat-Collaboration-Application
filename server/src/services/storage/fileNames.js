import path from 'node:path';

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

/** Extension derived from the validated MIME type (never trusted from the client's file name). */
export const safeExtension = (_originalName, mimeType) => MIME_EXTENSIONS[mimeType] || 'bin';

/**
 * Multer/busboy decodes multipart file names as latin1; restore UTF-8 and strip anything
 * that could be abused (paths, control characters, excessive length).
 */
export function sanitizeFileName(name, mimeType) {
  let decoded = String(name || '');
  try {
    const utf8 = Buffer.from(decoded, 'latin1').toString('utf8');
    if (!utf8.includes('�')) decoded = utf8;
  } catch {
    /* keep original */
  }
  // eslint-disable-next-line no-control-regex
  let clean = path.basename(decoded).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_').trim();
  if (!clean || clean === '.' || clean === '..') clean = `file.${safeExtension(null, mimeType)}`;
  if (clean.length > 120) {
    const ext = path.extname(clean).slice(0, 10);
    clean = `${clean.slice(0, 120 - ext.length)}${ext}`;
  }
  return clean;
}
