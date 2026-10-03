import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { createCloudinaryDriver } from './cloudinaryDriver.js';
import { createLocalDriver } from './localDriver.js';

/**
 * Storage driver selection (STORAGE_DRIVER):
 *  - auto (default): Cloudinary when CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
 *    CLOUDINARY_API_SECRET are all set; otherwise local disk in development, and uploads
 *    disabled in production (the rest of the app keeps working).
 *  - cloudinary | local | disabled: explicit choice.
 */
function resolveDriver() {
  const { driver, hasCloudinary, missingCloudinaryVars, cloudinary, publicServerUrl } = config.storage;
  const partiallyConfigured = !hasCloudinary && missingCloudinaryVars.length < 3;

  if (driver === 'disabled') return null;

  if (partiallyConfigured) {
    logger.warn(`[storage] Cloudinary is not active yet — missing ${missingCloudinaryVars.join(', ')} in the environment.`);
  }

  if (driver === 'cloudinary' || (driver === 'auto' && hasCloudinary)) {
    if (!hasCloudinary) {
      logger.error(`[storage] STORAGE_DRIVER=cloudinary but ${missingCloudinaryVars.join(', ')} ${missingCloudinaryVars.length === 1 ? 'is' : 'are'} missing — uploads disabled.`);
      return null;
    }
    try {
      return createCloudinaryDriver(cloudinary);
    } catch (err) {
      logger.error(`[storage] ${err.message} — uploads disabled.`);
      return null;
    }
  }

  if (driver === 'local') {
    if (config.isProd) logger.warn('[storage] Local disk storage in production: files are lost when the instance restarts unless a persistent disk is mounted.');
    return createLocalDriver({ publicServerUrl });
  }

  // auto without Cloudinary
  if (!config.isProd) return createLocalDriver({ publicServerUrl });
  logger.warn('[storage] No production storage configured (set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET) — file and image uploads are disabled.');
  return null;
}

const driver = resolveDriver();

export const storage = {
  get enabled() {
    return Boolean(driver);
  },

  get driverName() {
    return driver?.name ?? 'disabled';
  },

  /**
   * @param {{buffer: Buffer, originalname: string, mimetype: string, size: number}} file
   * @param {{folder: string, kind: 'image'|'file', variant?: 'avatar'}} options
   */
  async upload(file, options) {
    if (!driver) {
      throw AppError.unavailable(
        'File uploads are not configured on this server yet. Please try again later.',
        'STORAGE_DISABLED'
      );
    }
    try {
      return await driver.upload(file, options);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('[storage] Upload failed:', err.message);
      throw new AppError(502, 'File upload failed. Please try again.', 'UPLOAD_FAILED');
    }
  },

  /** Best-effort delete; never throws. */
  async remove(media) {
    if (!driver || !media?.publicId) return;
    if (media.provider && media.provider !== driver.name) return;
    try {
      await driver.remove(media);
    } catch (err) {
      logger.warn('[storage] Failed to delete file:', err.message);
    }
  },

  async removeMany(mediaList = []) {
    await Promise.all(mediaList.map((media) => this.remove(media)));
  },
};
