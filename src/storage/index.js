const { storage } = require('../config/env');

// Drivers are loaded lazily so a missing Supabase/Cloudinary key only matters
// when that provider is actually selected.
const drivers = {
  local: () => require('./local'),
  supabase: () => require('./supabase'),
  cloudinary: () => require('./cloudinary'),
};

function loadDriver(provider) {
  const load = drivers[provider];
  if (!load) {
    throw new Error(
      `Unknown storage provider "${provider}". Expected one of: ${Object.keys(drivers).join(', ')}`,
    );
  }
  return load();
}

// New uploads always go to the configured backend...
const primary = loadDriver(storage.provider);

// ...but existing rows remember where their bytes actually went, so reads and
// deletes follow File.provider. Without this, switching STORAGE_PROVIDER would
// strand every file uploaded under the previous one.
function driverFor(provider) {
  return !provider || provider === primary.name ? primary : loadDriver(provider);
}

module.exports = {
  name: primary.name,
  save: (input) => primary.save(input),
  remove: (storageKey, provider) => driverFor(provider).remove(storageKey),
  getDownload: (file) => driverFor(file.provider).getDownload(file),
};
