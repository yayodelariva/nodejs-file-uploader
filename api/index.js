// Vercel entry point. Serverless functions are handed an (req, res) pair by the
// platform, so we export the Express app itself instead of calling listen().
// `src/server.js` stays the entry point for running the app as a normal process.
module.exports = require('../src/app');
