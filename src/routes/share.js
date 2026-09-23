const express = require('express');

const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../db/prisma');
const shares = require('../services/shares');
const folders = require('../services/folders');
const { sendDownload } = require('./files');

const router = express.Router();

function renderGone(res) {
  return res.status(410).render('share/expired', { title: 'Link unavailable' });
}

// Public routes: no session required, so the link itself is the credential.
// Every handler re-checks that the link is live and that the requested item
// really sits inside the shared subtree.
async function loadShare(req, res) {
  const share = await shares.findActive(req.params.token);
  if (!share) {
    renderGone(res);
    return null;
  }
  return share;
}

async function renderSharedFolder(req, res, share, folder) {
  const { folders: children, files } = await folders.listContents(folder.id, share.ownerId);
  const fullTrail = await folders.breadcrumbs(folder);
  // Only show the trail from the shared root downwards.
  const rootIndex = fullTrail.findIndex((entry) => entry.id === share.folderId);
  const trail = rootIndex === -1 ? [folder] : fullTrail.slice(rootIndex);

  res.render('share/folder', {
    title: folder.name,
    share,
    folder,
    children,
    files,
    trail,
  });
}

router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const share = await loadShare(req, res);
    if (share) await renderSharedFolder(req, res, share, share.folder);
  }),
);

router.get(
  '/:token/folders/:folderId',
  asyncHandler(async (req, res) => {
    const share = await loadShare(req, res);
    if (!share) return;

    const folder = await prisma.folder.findUnique({ where: { id: req.params.folderId } });
    if (!folder || !(await shares.folderInShare(share, folder.id))) return void renderGone(res);

    await renderSharedFolder(req, res, share, folder);
  }),
);

router.get(
  '/:token/files/:fileId',
  asyncHandler(async (req, res) => {
    const share = await loadShare(req, res);
    if (!share) return;

    const file = await shares.findFileInShare(share, req.params.fileId);
    if (!file) return void renderGone(res);

    res.render('files/show', { title: file.name, file, trail: [], share });
  }),
);

router.get(
  '/:token/files/:fileId/download',
  asyncHandler(async (req, res, next) => {
    const share = await loadShare(req, res);
    if (!share) return;

    const file = await shares.findFileInShare(share, req.params.fileId);
    if (!file) return void renderGone(res);

    await sendDownload(res, next, file);
  }),
);

module.exports = router;
