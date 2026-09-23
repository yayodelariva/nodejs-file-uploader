const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const prisma = require('../db/prisma');
const passport = require('../auth/passport');
const asyncHandler = require('../utils/asyncHandler');
const { ensureGuest } = require('../middleware/auth');

const router = express.Router();

const registerValidators = [
  body('name').trim().isLength({ min: 1, max: 60 }).withMessage('Please enter your name'),
  // Lower-casing (rather than normalizeEmail) keeps this identical to the
  // lookup in the local strategy, so an address always matches itself.
  body('email').trim().isEmail().withMessage('Please enter a valid email address').toLowerCase(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
];

router.get('/register', ensureGuest, (req, res) => {
  res.render('auth/register', { title: 'Create an account', errors: [], values: {} });
});

router.post(
  '/register',
  ensureGuest,
  registerValidators,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const errors = validationResult(req).array();

    if (!errors.length && (await prisma.user.findUnique({ where: { email } }))) {
      errors.push({ msg: 'An account with that email already exists' });
    }

    if (errors.length) {
      return res.status(400).render('auth/register', {
        title: 'Create an account',
        errors,
        values: { name, email },
      });
    }

    const user = await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 12) },
    });

    // Log the new account straight in rather than bouncing through the form.
    return req.login(user, (err) => {
      if (err) throw err;
      req.flash('success', `Welcome, ${user.name}`);
      return res.redirect('/drive');
    });
  }),
);

router.get('/login', ensureGuest, (req, res) => {
  res.render('auth/login', { title: 'Log in', values: {} });
});

router.post('/login', ensureGuest, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info?.message || 'Incorrect email or password');
      return res.status(401).render('auth/login', { title: 'Log in', values: { email: req.body.email } });
    }
    return req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      const destination = req.session.returnTo || '/drive';
      delete req.session.returnTo;
      req.flash('success', `Welcome back, ${user.name}`);
      return res.redirect(destination);
    });
  })(req, res, next);
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    // Drop the session row as well so the store does not keep dead records.
    return req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie('uploader.sid');
      return res.redirect('/');
    });
  });
});

module.exports = router;
