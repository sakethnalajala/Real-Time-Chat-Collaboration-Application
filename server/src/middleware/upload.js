import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { ATTACHMENT_TYPES, IMAGE_TYPES } from '../utils/constants.js';
import { sanitizeFileName } from '../services/storage/fileNames.js';

const MB = 1024 * 1024;
const { maxFileSizeMB, maxFilesPerMessage, maxAvatarSizeMB } = config.storage;

const unsupported = (name) =>
  new AppError(415, `"${sanitizeFileName(name)}" is not a supported file type`, 'UNSUPPORTED_FILE_TYPE');

const attachmentFilter = (_req, file, cb) => (ATTACHMENT_TYPES[file.mimetype] ? cb(null, true) : cb(unsupported(file.originalname)));
const imageFilter = (_req, file, cb) =>
  IMAGE_TYPES.includes(file.mimetype)
    ? cb(null, true)
    : cb(new AppError(415, 'Please choose a JPG, PNG, WebP or GIF image', 'UNSUPPORTED_FILE_TYPE'));

const limits = (fileSizeMB, files) => ({ fileSize: fileSizeMB * MB, files, fields: 20, fieldSize: 64 * 1024, parts: 40 });

const attachmentsParser = multer({
  storage: multer.memoryStorage(),
  limits: limits(maxFileSizeMB, maxFilesPerMessage),
  fileFilter: attachmentFilter,
}).array('files', maxFilesPerMessage);

const imageParser = (field) =>
  multer({ storage: multer.memoryStorage(), limits: limits(maxAvatarSizeMB, 1), fileFilter: imageFilter }).single(field);

const looksLikeText = (buffer) => {
  const sample = buffer.subarray(0, 8192);
  if (sample.includes(0)) return false;
  return !new TextDecoder('utf-8', { fatal: false }).decode(sample).includes('�');
};

/**
 * Never trust the browser's declared MIME type: sniff the real content (magic bytes)
 * and reject files whose bytes do not match an allowed type.
 */
async function verifyFile(file) {
  const rule = ATTACHMENT_TYPES[file.mimetype];
  if (!rule || !file.size) throw unsupported(file.originalname);

  if (rule.detect === null) {
    if (!looksLikeText(file.buffer)) throw unsupported(file.originalname);
  } else {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !rule.detect.includes(detected.mime)) throw unsupported(file.originalname);
  }
  file.originalname = sanitizeFileName(file.originalname, file.mimetype);
}

const withVerification = (parser) => (req, res, next) => {
  parser(req, res, async (err) => {
    if (err) return next(err);
    try {
      const files = req.files ?? (req.file ? [req.file] : []);
      for (const file of files) await verifyFile(file);
      next();
    } catch (verifyErr) {
      next(verifyErr);
    }
  });
};

/** Up to MAX_FILES_PER_MESSAGE attachments in the `files` field. */
export const uploadAttachments = withVerification(attachmentsParser);

/** A single image (avatar / group photo) in the given field. */
export const uploadImage = (field) => withVerification(imageParser(field));
