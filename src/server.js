const app = require('./app');
const prisma = require('./db/prisma');
const config = require('./config/env');

const server = app.listen(config.port, () => {
  console.log(`File uploader listening on http://localhost:${config.port} (storage: ${config.storage.provider})`);
});

// Close the HTTP server and the connection pool so restarts do not leak them.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
