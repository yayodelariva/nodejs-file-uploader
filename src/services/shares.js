const prisma = require('../db/prisma');
const folders = require('./folders');

function create({ folderId, ownerId, durationMs }) {
  return prisma.share.create({
    data: { folderId, ownerId, expiresAt: new Date(Date.now() + durationMs) },
  });
}

// Expired links are treated as if they never existed.
function findActive(id) {
  return prisma.share.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
    include: { folder: true },
  });
}

function listForFolder(folderId) {
  return prisma.share.findMany({
    where: { folderId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}

function revoke(id, ownerId) {
  return prisma.share.deleteMany({ where: { id, ownerId } });
}

// A share covers its folder and everything nested below it, so visitors may
// only reach folders inside that subtree.
async function folderInShare(share, folderId) {
  if (folderId === share.folderId) return true;
  const ids = await folders.descendantIds(share.folderId);
  return ids.includes(folderId);
}

async function findFileInShare(share, fileId) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, include: { folder: true } });
  if (!file || !file.folderId) return null;
  return (await folderInShare(share, file.folderId)) ? file : null;
}

module.exports = { create, findActive, listForFolder, revoke, folderInShare, findFileInShare };
