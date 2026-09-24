const prisma = require('../db/prisma');
const storage = require('../storage');

// Every lookup is scoped by ownerId, so an id guessed from another account
// simply comes back as "not found".
function findOwned(id, ownerId) {
  return prisma.folder.findFirst({ where: { id, ownerId } });
}

async function listContents(folderId, ownerId) {
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId, parentId: folderId },
      orderBy: { name: 'asc' },
    }),
    prisma.file.findMany({
      where: { ownerId, folderId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { folders, files };
}

// Walks up to the root so views can render a trail of links.
async function breadcrumbs(folder) {
  const trail = [];
  let current = folder;
  while (current) {
    trail.unshift(current);
    current = current.parentId
      ? await prisma.folder.findUnique({ where: { id: current.parentId } })
      : null;
  }
  return trail;
}

// Level-by-level walk down the tree; includes the starting folder.
async function descendantIds(folderId) {
  const ids = [folderId];
  let frontier = [folderId];
  while (frontier.length) {
    const children = await prisma.folder.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((child) => child.id);
    ids.push(...frontier);
  }
  return ids;
}

function create({ name, parentId, ownerId }) {
  return prisma.folder.create({ data: { name, parentId: parentId || null, ownerId } });
}

function rename(id, ownerId, name) {
  return prisma.folder.updateMany({ where: { id, ownerId }, data: { name } });
}

async function remove(id, ownerId) {
  const folder = await findOwned(id, ownerId);
  if (!folder) return null;

  // Postgres cascades the rows; the stored objects have to be cleaned up by
  // hand, so collect their keys before the rows disappear.
  const ids = await descendantIds(id);
  const files = await prisma.file.findMany({
    where: { folderId: { in: ids } },
    select: { storageKey: true, provider: true },
  });

  await prisma.folder.delete({ where: { id } });
  await Promise.allSettled(files.map((file) => storage.remove(file.storageKey, file.provider)));
  return folder;
}

module.exports = {
  findOwned,
  listContents,
  breadcrumbs,
  descendantIds,
  create,
  rename,
  remove,
};
