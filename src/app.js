const path = require('node:path');

const express = require('express');
const session = require('express-session');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const methodOverride = require('method-override');

const flash = require('./middleware/flash');

const config = require('./config/env');
const prisma = require('./db/prisma');
const passport = require('./auth/passport');
const storage = require('./storage');
const { formatBytes, formatDate } = require('./utils/format');
const { allowedExtensionList } = require('./config/uploadRules');

const authRoutes = require('./routes/auth');
const folderRoutes = require('./routes/folders');
const { router: fileRoutes } = require('./routes/files');
const shareRoutes = require('./routes/share');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
// Trust the proxy in production so secure cookies survive a TLS terminator.
if (config.isProduction) app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: false }));
// Lets HTML forms issue PUT/DELETE through a hidden _method field.
app.use(methodOverride('_method'));

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'uploader.sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    store: new PrismaSessionStore(prisma, {
      // Sweep expired rows every two minutes. Serverless instances freeze
      // between requests, so the timer is skipped there; the store still
      // refuses expired sessions when it reads them.
      checkPeriod: process.env.VERCEL ? undefined : 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  }),
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash);

// Everything the templates need, resolved once per request.
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  res.locals.formatBytes = formatBytes;
  res.locals.formatDate = formatDate;
  res.locals.maxUploadMb = config.upload.maxMb;
  res.locals.allowedExtensions = allowedExtensionList;
  res.locals.storageProvider = storage.name;
  res.locals.currentPath = req.path;
  next();
});

app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/drive');
  return res.render('home', { title: 'File Uploader' });
});

app.use('/', authRoutes);
app.use('/drive', folderRoutes);
app.use('/files', fileRoutes);
app.use('/share', shareRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
