const path = require('node:path');

const multer = require('multer');

const { upload } = require('../config/env');
const { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, allowedExtensionList } = require('../config/uploadRules');

class UploadTypeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UploadTypeError';
    this.status = 400;
  }
}

// Buffering in memory keeps a single code path for every storage driver: the
// local driver writes the buffer to disk, the cloud drivers stream it onward.
const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: upload.maxBytes, files: 1 },
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(extension)) {
      return cb(
        new UploadTypeError(
          `"${file.originalname}" is not an accepted file type. Allowed: ${allowedExtensionList}`,
        ),
      );
    }
    return cb(null, true);
  },
}).single('file');

// Multer reports its own failures through `next`, which would surface as a 500.
// Translating them here keeps the user on the page with a readable message.
function handleUpload(req, res, next) {
  uploadFile(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      req.uploadError = `That file is larger than the ${upload.maxMb} MB limit`;
    } else if (err instanceof multer.MulterError) {
      req.uploadError = 'That upload could not be processed';
    } else if (err.name === 'UploadTypeError') {
      req.uploadError = err.message;
    } else {
      return next(err);
    }
    return next();
  });
}

module.exports = { handleUpload, UploadTypeError };
