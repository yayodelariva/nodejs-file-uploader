function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  // Remember where they were heading so login can send them back.
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.flash('error', 'Please log in to continue');
  return res.redirect('/login');
}

function ensureGuest(req, res, next) {
  if (req.isAuthenticated()) return res.redirect('/drive');
  return next();
}

module.exports = { ensureAuthenticated, ensureGuest };
