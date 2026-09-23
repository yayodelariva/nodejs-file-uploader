const path = require('node:path');
const crypto = require('node:crypto');

const cloudinary = require('cloudinary').v2;
const { storage } = require('../config/env');

const { cloudName, apiKey, apiSecret, folder } = storage.cloudinary;
if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'STORAGE_PROVIDER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET',
  );
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

// Cloudinary needs the resource type both to delete and to sign a URL, so it
// travels with the public id inside storageKey as "<resource_type>:<public_id>".
function splitKey(storageKey) {
  const [resourceType, ...rest] = storageKey.split(':');
  return { resourceType, publicId: rest.join(':') };
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) =>
      error ? reject(error) : resolve(result),
    );
    stream.end(buffer);
  });
}

module.exports = {
  name: 'cloudinary',

  async save({ buffer, originalName, ownerId }) {
    const result = await uploadBuffer(buffer, {
      resource_type: 'auto',
      folder: path.posix.join(folder, ownerId),
      public_id: crypto.randomUUID(),
      // Keep the extension out of the public id but preserve it on delivery.
      filename_override: originalName,
      use_filename: false,
    });
    return {
      storageKey: `${result.resource_type}:${result.public_id}`,
      url: result.secure_url,
    };
  },

  async remove(storageKey) {
    const { resourceType, publicId } = splitKey(storageKey);
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  },

  async getDownload(file) {
    const { resourceType, publicId } = splitKey(file.storageKey);
    // `attachment:<name>` makes Cloudinary serve the file as a download with a
    // friendly filename instead of rendering it inline.
    const downloadName = path.parse(file.name).name.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'download';
    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true,
      flags: `attachment:${downloadName}`,
    });
    return { type: 'redirect', url };
  },
};
