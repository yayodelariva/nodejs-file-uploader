const prisma = require('../db/prisma');
const storage = require('../storage');

function findOwned(id, ownerId) {
  return prisma.file.findFirst({ where: { id, ownerId }, include: { folder: true } });
}

// Pushes the bytes to the configured backend first: if that throws there is no
// orphaned row pointing at a file that was never stored.
async function save({ file, folderId, ownerId }) {
  const { storageKey, url } = await storage.save({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    ownerId,
  });

  try {
    return await prisma.file.create({
      data: {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        provider: storage.name,
        storageKey,
        url,
        ownerId,
        folderId: folderId || null,
      },
    });
  } catch (err) {
    await storage.remove(storageKey).catch(() => {});
    throw err;
  }
}

async function remove(id, ownerId) {
  const file = await findOwned(id, ownerId);
  if (!file) return null;
  await prisma.file.delete({ where: { id } });
  await storage.remove(file.storageKey, file.provider).catch(() => {});
  return file;
}

module.exports = { findOwned, save, remove };
