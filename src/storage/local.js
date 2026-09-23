const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { storage } = require('../config/env');

const root = path.resolve(process.cwd(), storage.localDir);

// Keys are generated here (never taken from the client), but resolving them
// back through the root guards against a malformed row escaping the directory.
function resolveKey(key) {
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Refusing to access a path outside the upload directory');
  }
  return full;
}

module.exports = {
  name: 'local',

  async save({ buffer, originalName, ownerId }) {
    const key = path.posix.join(ownerId, `${crypto.randomUUID()}${path.extname(originalName)}`);
    const full = resolveKey(key);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, buffer);
    return { storageKey: key, url: null };
  },

  async remove(storageKey) {
    await fsp.rm(resolveKey(storageKey), { force: true });
  },

  async getDownload(file) {
    const full = resolveKey(file.storageKey);
    await fsp.access(full, fs.constants.R_OK);
    return { type: 'stream', stream: fs.createReadStream(full) };
  },
};
