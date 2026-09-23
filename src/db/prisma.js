const { PrismaClient } = require('@prisma/client');
const { isProduction } = require('../config/env');

// A single client is shared by the whole process: each instance owns a
// connection pool, so creating them per request would exhaust Postgres.
const prisma = new PrismaClient({
  log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
});

module.exports = prisma;
