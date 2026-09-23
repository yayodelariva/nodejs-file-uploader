const express = require('express');

const asyncHandler = require('../utils/asyncHandler');
const { ensureAuthenticated } = require('../middleware/auth');
const { handleUpload } = require('../middleware/upload');
const files = require('../services/files');
const folders = require('../services/folders');
const storage = require('../storage');

const router = express.Router();

router.use(ensureAuthenticated);

// Streams the bytes back, or hands the browser a short-lived cloud URL.
async function sendDownload(res, next, file) {
  try {
    const result = await storage.getDownload(file);
    if (result.type === 'redirect') return res.redirect(result.url);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    // encodeURIComponent keeps non-ASCII names valid in the header.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    result.stream.on('error', next);
    return result.stream.pipe(res);
  } catch (err) {
    return next(err);
  }
}

router.post(
  '/',
  handleUpload,
  asyncHandler(async (req, res) => {
    const folderId = req.body.folderId || null;
    const back = folderId ? `/drive/${folderId}` : '/drive';

    // The destination folder must belong to the uploader.
    if (folderId && !(await folders.findOwned(folderId, req.user.id))) {
      req.flash('error', 'That folder does not exist');
      return res.redirect('/drive');
    }

    if (req.uploadError) {
      req.flash('error', req.uploadError);
      return res.redirect(back);
    }
    if (!req.file) {
      req.flash('error', 'Choose a file to upload');
      return res.redirect(back);
    }

    const saved = await files.save({ file: req.file, folderId, ownerId: req.user.id });
    req.flash('success', `Uploaded "${saved.name}"`);
    return res.redirect(back);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const file = await files.findOwned(req.params.id, req.user.id);
    if (!file) {
      return res.status(404).render('error', {
        title: 'Not found',
        status: 404,
        message: 'That file does not exist.',
        detail: null,
      });
    }
    const trail = file.folder ? await folders.breadcrumbs(file.folder) : [];
    return res.render('files/show', { title: file.name, file, trail, share: null });
  }),
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res, next) => {
    const file = await files.findOwned(req.params.id, req.user.id);
    if (!file) {
      return res.status(404).render('error', {
        title: 'Not found',
        status: 404,
        message: 'That file does not exist.',
        detail: null,
      });
    }
    return sendDownload(res, next, file);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const file = await files.remove(req.params.id, req.user.id);
    if (!file) {
      req.flash('error', 'That file does not exist');
      return res.redirect('/drive');
    }
    req.flash('success', `Deleted "${file.name}"`);
    return res.redirect(file.folderId ? `/drive/${file.folderId}` : '/drive');
  }),
);

module.exports = { router, sendDownload };
