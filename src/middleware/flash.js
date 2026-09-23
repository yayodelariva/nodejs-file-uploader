// A stand-in for connect-flash, which still calls the deprecated util.isArray.
// Messages live on the session and are cleared as soon as they are read, so
// each one is shown on exactly one page.
module.exports = function flash(req, res, next) {
  req.flash = function push(type, message) {
    req.session.flash ??= {};
    if (message === undefined) {
      const messages = req.session.flash[type] || [];
      delete req.session.flash[type];
      return messages;
    }
    (req.session.flash[type] ??= []).push(message);
    return req.session.flash[type].length;
  };
  next();
};
