// Files are validated twice: multer rejects anything outside this list as it
// streams, and the size cap below is enforced by multer's own limits.
const ALLOWED_TYPES = [
  { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  { mime: 'image/png', extensions: ['.png'] },
  { mime: 'image/gif', extensions: ['.gif'] },
  { mime: 'image/webp', extensions: ['.webp'] },
  { mime: 'image/svg+xml', extensions: ['.svg'] },
  { mime: 'application/pdf', extensions: ['.pdf'] },
  { mime: 'text/plain', extensions: ['.txt', '.md', '.log'] },
  { mime: 'text/csv', extensions: ['.csv'] },
  { mime: 'text/markdown', extensions: ['.md'] },
  { mime: 'application/json', extensions: ['.json'] },
  { mime: 'application/zip', extensions: ['.zip'] },
  { mime: 'application/msword', extensions: ['.doc'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
  },
  { mime: 'application/vnd.ms-excel', extensions: ['.xls'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['.pptx'],
  },
  { mime: 'audio/mpeg', extensions: ['.mp3'] },
  { mime: 'video/mp4', extensions: ['.mp4'] },
];

const ALLOWED_MIME_TYPES = new Set(ALLOWED_TYPES.map((type) => type.mime));
const ALLOWED_EXTENSIONS = new Set(ALLOWED_TYPES.flatMap((type) => type.extensions));

module.exports = {
  ALLOWED_TYPES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  allowedExtensionList: [...ALLOWED_EXTENSIONS].sort().join(', '),
};
