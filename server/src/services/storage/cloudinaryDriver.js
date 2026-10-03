import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { safeExtension } from './fileNames.js';

/**
 * Cloudinary storage, configured from CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
 * CLOUDINARY_API_SECRET. The secret stays on the server: uploads are signed here and the
 * browser only ever receives the resulting public HTTPS URLs.
 */
export function createCloudinaryDriver({ cloudName, apiKey, apiSecret, folder }) {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const baseFolder = folder || 'nebula-chat';

  return {
    name: 'cloudinary',

    upload(file, { folder, kind, variant }) {
      const resourceType = kind === 'image' ? 'image' : 'raw';
      const ext = safeExtension(file.originalname, file.mimetype);
      // Raw files keep their extension in the public id so downloads have the right type.
      const publicId = crypto.randomUUID() + (resourceType === 'raw' && ext ? `.${ext}` : '');
      const transformation =
        variant === 'avatar' ? [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }] : undefined;

      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${baseFolder}/${folder}`,
            public_id: publicId,
            resource_type: resourceType,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            transformation,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              provider: 'cloudinary',
              resourceType,
              width: result.width ?? null,
              height: result.height ?? null,
              size: result.bytes ?? file.size,
            });
          }
        );
        stream.end(file.buffer);
      });
    },

    async remove(media) {
      await cloudinary.uploader.destroy(media.publicId, {
        resource_type: media.resourceType || 'image',
        invalidate: true,
      });
    },
  };
}
