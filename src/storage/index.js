const { storage } = require('../config/env');

// Drivers are loaded lazily so a missing Supabase/Cloudinary key only matters
// when that provider is actually selected.
const drivers = {
  local: () => require('./local'),
  supabase: () => require('./supabase'),
  cloudinary: () => require('./cloudinary'),
};

const load = drivers[storage.provider];
if (!load) {
  throw new Error(
    `Unknown STORAGE_PROVIDER "${storage.provider}". Expected one of: ${Object.keys(drivers).join(', ')}`,
  );
}

module.exports = load();
