require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),

  upload: {
    maxBytes: (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024,
    maxMb: Number(process.env.MAX_UPLOAD_MB) || 10,
  },

  storage: {
    provider,
    localDir: process.env.LOCAL_UPLOAD_DIR || 'uploads',
    supabase: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_KEY,
      bucket: process.env.SUPABASE_BUCKET || 'uploads',
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      folder: process.env.CLOUDINARY_FOLDER || 'file-uploader',
    },
  },
};
