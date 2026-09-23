const path = require('node:path');
const crypto = require('node:crypto');

const { createClient } = require('@supabase/supabase-js');
const { storage } = require('../config/env');

const { url, key: serviceKey, bucket } = storage.supabase;
if (!url || !serviceKey) {
  throw new Error('STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_KEY');
}

const client = createClient(url, serviceKey, { auth: { persistSession: false } });

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

module.exports = {
  name: 'supabase',

  async save({ buffer, originalName, mimeType, ownerId }) {
    const storageKey = path.posix.join(ownerId, `${crypto.randomUUID()}${path.extname(originalName)}`);
    unwrap(
      await client.storage.from(bucket).upload(storageKey, buffer, {
        contentType: mimeType,
        upsert: false,
      }),
    );
    const { data } = client.storage.from(bucket).getPublicUrl(storageKey);
    return { storageKey, url: data?.publicUrl ?? null };
  },

  async remove(storageKey) {
    unwrap(await client.storage.from(bucket).remove([storageKey]));
  },

  async getDownload(file) {
    // Signed so the bucket can stay private; `download` sets the attachment name.
    const data = unwrap(
      await client.storage.from(bucket).createSignedUrl(file.storageKey, 60, { download: file.name }),
    );
    return { type: 'redirect', url: data.signedUrl };
  },
};
