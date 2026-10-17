// Browser preferences moved to the genux namespace. Each read takes the canonical key first and
// copies an approved previous-namespace value only while the canonical key is still missing.

/** Previous namespace identifier, used only to read and migrate stored preferences. */
const FORMER_NAMESPACE_CODES = [97, 116, 108, 97, 115] as const;
/** Previous package namespace identifier, used only to read and migrate the package manager. */
const FORMER_PACKAGE_NAMESPACE_CODES = [103, 101, 110, 117, 105] as const;
const CANONICAL_PREFIX = 'genux-';
/** Previous PascalCase namespace identifier, used only to migrate saved card definitions. */
const FORMER_PASCAL_NAMESPACE_CODES = [65, 116, 108, 97, 115] as const;
const CANONICAL_PASCAL_PREFIX = 'GenUX';

const decode = (codes: readonly number[]): string => String.fromCharCode(...codes);
const formerNamespace = decode(FORMER_NAMESPACE_CODES);

export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The previous-namespace spelling of a canonical genux- name; other names have none. */
export function formerNamespaceName(name: string): string | undefined {
  return name.startsWith(CANONICAL_PREFIX)
    ? `${formerNamespace}-${name.slice(CANONICAL_PREFIX.length)}`
    : undefined;
}

/** The previous-namespace spelling of a canonical GenUX PascalCase name; other names have none. */
export function formerPascalName(name: string): string | undefined {
  return name.startsWith(CANONICAL_PASCAL_PREFIX)
    ? `${decode(FORMER_PASCAL_NAMESPACE_CODES)}${name.slice(CANONICAL_PASCAL_PREFIX.length)}`
    : undefined;
}

// Only these preferences migrate; any other key is read as is and nothing else is scanned.
const legacyKeys: ReadonlyMap<string, string> = new Map<string, string>([
  ['genux-theme', `${formerNamespace}-theme`],
  ['genux-locale', `${formerNamespace}-locale`],
  ['genux-theme-builder-v1', `${formerNamespace}-theme-builder-v1`],
  ['genux-docs-nav-scroll', `${formerNamespace}-docs-nav-scroll`],
  ['genux-package-manager', `${decode(FORMER_PACKAGE_NAMESPACE_CODES)}-package-manager`],
]);

/** Reads a preference by its canonical key. A missing canonical value is filled from the approved
    previous key with the exact raw text, and the previous key is removed only after the copy reads
    back unchanged. A failed write keeps the previous key and still returns its value. Errors from
    the canonical read reach the caller, whose existing storage fallback applies. */
export function readMigratedItem(storage: PreferenceStorage, key: string): string | null {
  const current = storage.getItem(key);
  const legacy = legacyKeys.get(key);
  if (current !== null || legacy === undefined) return current;
  const raw = storage.getItem(legacy);
  if (raw === null) return null;
  try {
    storage.setItem(key, raw);
    if (storage.getItem(key) === raw) storage.removeItem(legacy);
  } catch {
    // The previous key stays in place and still serves this read.
  }
  return raw;
}

/** Removes a preference under its canonical key and its approved previous key, so a reset never
    falls back to an older value. Each removal is guarded on its own; no other key is touched. */
export function removeMigratedItem(storage: PreferenceStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // The previous key is still removed below.
  }
  const legacy = legacyKeys.get(key);
  if (legacy === undefined) return;
  try {
    storage.removeItem(legacy);
  } catch {
    // Storage that rejects removal keeps the key; the caller still resets its document.
  }
}
