const express = require('express');
const { body, validationResult } = require('express-validator');

const asyncHandler = require('../utils/asyncHandler');
const { ensureAuthenticated } = require('../middleware/auth');
const folders = require('../services/folders');
const shares = require('../services/shares');
const { parseDuration, formatDate } = require('../utils/format');

const router = express.Router();

router.use(ensureAuthenticated);

const nameValidator = body('name')
  .trim()
  .isLength({ min: 1, max: 80 })
  .withMessage('Folder names must be between 1 and 80 characters')
  .matches(/^[^/\\]+$/)
  .withMessage('Folder names cannot contain slashes');

// Loads a folder the current user owns, or ends the request with a 404.
async function loadFolder(req, res) {
  const folder = await folders.findOwned(req.params.id, req.user.id);
  if (!folder) {
    res.status(404).render('error', {
      title: 'Not found',
      status: 404,
      message: 'That folder does not exist.',
      detail: null,
    });
    return null;
  }
  return folder;
}

async function renderFolder(req, res, folder, extra = {}) {
  const folderId = folder ? folder.id : null;
  const [{ folders: children, files }, trail] = await Promise.all([
    folders.listContents(folderId, req.user.id),
    folder ? folders.breadcrumbs(folder) : [],
  ]);

  res.render('folders/show', {
    title: folder ? folder.name : 'My drive',
    folder,
    children,
    files,
    trail,
    errors: [],
    ...extra,
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => renderFolder(req, res, null)),
);

router.post(
  '/',
  nameValidator,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req).array();
    const parentId = req.body.parentId || null;

    // A parent supplied by the form still has to belong to the current user.
    const parent = parentId ? await folders.findOwned(parentId, req.user.id) : null;
    if (parentId && !parent) return res.status(404).redirect('/drive');

    if (errors.length) {
      res.status(400);
      return renderFolder(req, res, parent, { errors });
    }

    const created = await folders.create({ name: req.body.name, parentId, ownerId: req.user.id });
    req.flash('success', `Folder "${created.name}" created`);
    return res.redirect(parent ? `/drive/${parent.id}` : '/drive');
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const folder = await loadFolder(req, res);
    if (folder) await renderFolder(req, res, folder);
  }),
);

router.get(
  '/:id/edit',
  asyncHandler(async (req, res) => {
    const folder = await loadFolder(req, res);
    if (!folder) return;
    res.render('folders/edit', { title: `Rename ${folder.name}`, folder, errors: [] });
  }),
);

router.put(
  '/:id',
  nameValidator,
  asyncHandler(async (req, res) => {
    const folder = await loadFolder(req, res);
    if (!folder) return;

    const errors = validationResult(req).array();
    if (errors.length) {
      res.status(400).render('folders/edit', { title: `Rename ${folder.name}`, folder, errors });
      return;
    }

    await folders.rename(folder.id, req.user.id, req.body.name);
    req.flash('success', 'Folder renamed');
    res.redirect(`/drive/${folder.id}`);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const folder = await folders.remove(req.params.id, req.user.id);
    if (!folder) {
      req.flash('error', 'That folder does not exist');
      return res.redirect('/drive');
    }
    req.flash('success', `Deleted "${folder.name}" and everything inside it`);
    return res.redirect(folder.parentId ? `/drive/${folder.parentId}` : '/drive');
  }),
);

// --- Sharing --------------------------------------------------------------

router.get(
  '/:id/share',
  asyncHandler(async (req, res) => {
    const folder = await loadFolder(req, res);
    if (!folder) return;
    const links = await shares.listForFolder(folder.id);
    res.render('folders/share', {
      title: `Share ${folder.name}`,
      folder,
      links,
      errors: [],
      baseUrl: `${req.protocol}://${req.get('host')}`,
    });
  }),
);

router.post(
  '/:id/share',
  asyncHandler(async (req, res) => {
    const folder = await loadFolder(req, res);
    if (!folder) return;

    const durationMs = parseDuration(req.body.duration);
    if (!durationMs) {
      const links = await shares.listForFolder(folder.id);
      res.status(400).render('folders/share', {
        title: `Share ${folder.name}`,
        folder,
        links,
        errors: [{ msg: 'Enter a duration such as 30m, 12h, 7d or 2w' }],
        baseUrl: `${req.protocol}://${req.get('host')}`,
      });
      return;
    }

    const share = await shares.create({ folderId: folder.id, ownerId: req.user.id, durationMs });
    req.flash('success', `Share link created, valid until ${formatDate(share.expiresAt)}`);
    res.redirect(`/drive/${folder.id}/share`);
  }),
);

router.delete(
  '/:id/share/:shareId',
  asyncHandler(async (req, res) => {
    const folder = await loadFolder(req, res);
    if (!folder) return;
    await shares.revoke(req.params.shareId, req.user.id);
    req.flash('success', 'Share link revoked');
    res.redirect(`/drive/${folder.id}/share`);
  }),
);

module.exports = router;
