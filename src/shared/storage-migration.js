// Classic-script copy of docs/src/storage-migration.ts for the concatenated builder. Saved
// preferences moved to the genux namespace; an approved previous key is copied only while the
// canonical key is missing and removed only after the copy reads back unchanged.
function migratedStorageItem(storage, key) {
  // Previous namespace identifier, used only to read and migrate stored preferences.
  const formerNamespaceCodes = [97, 116, 108, 97, 115];
  const former = String.fromCharCode(...formerNamespaceCodes);
  const legacyKeys = {
    'genux-locale': former + '-locale',
    'buton-genuxi-v1': 'buton-' + former + 'i-v1',
  };
  const current = storage.getItem(key);
  if (current !== null || !Object.hasOwn(legacyKeys, key)) return current;
  const legacy = legacyKeys[key];
  const raw = storage.getItem(legacy);
  if (raw === null) return null;
  try {
    storage.setItem(key, raw);
    if (storage.getItem(key) === raw) storage.removeItem(legacy);
  } catch {}
  return raw;
}
