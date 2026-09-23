const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

const prisma = require('../db/prisma');

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      // The same message for both branches so the form cannot be used to
      // enumerate which addresses have accounts.
      const invalid = { message: 'Incorrect email or password' };
      if (!user) return done(null, false, invalid);

      const matches = await bcrypt.compare(password, user.password);
      if (!matches) return done(null, false, invalid);

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
