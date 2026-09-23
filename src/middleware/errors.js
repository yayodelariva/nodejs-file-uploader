const { isProduction } = require('../config/env');

function notFound(req, res, next) {
  res.status(404);
  res.render('error', { title: 'Not found', status: 404, message: 'That page does not exist.', detail: null });
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument shape.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);

  res.status(status);
  res.render('error', {
    title: 'Something went wrong',
    status,
    message: status >= 500 ? 'Something went wrong on our side.' : err.message,
    detail: isProduction || status < 500 ? null : err.stack,
  });
}

module.exports = { notFound, errorHandler };
