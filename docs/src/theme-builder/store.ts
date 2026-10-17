import { getThemeSnapshot, THEME_STORAGE_KEY, type ThemeMode } from '../theme';
import { parseRecipe, parseStoredRecipe, resolveThemeBuilder, type ThemeRecipe } from './model';
import { formerNamespaceName, readMigratedItem, removeMigratedItem } from '../storage-migration';

export const THEME_BUILDER_STORAGE_KEY = 'genux-theme-builder-v1';
const THEME_EVENT = 'genux-theme-change';
const BUILDER_ATTRIBUTE = 'data-genux-builder';
const MAX_RECIPE_BYTES = 32 * 1024;
/** A saved recipe is kept for 30 days after its last edit; the defaults return afterwards. */
export const THEME_BUILDER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
// The same key wraps recipes with their save time; raw recipes predate retention.
const STORAGE_FORMAT = 'genux-theme-builder';
const STORAGE_VERSION = 2;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const MAX_STORED_BYTES = MAX_RECIPE_BYTES + 1024;

export type ThemeBuilderResult = { ok: true; persisted: boolean } | { ok: false; error: string };

type ParsedRecipe = { ok: true; recipe: ThemeRecipe } | { ok: false; error: string };
// Explicit imports parse strictly; only stored recipes may lift earlier 12-13 px text sizes.
type RecipeParser = (text: string) => ParsedRecipe;
type OwnedValue = { value: string; priority: string };
type StoredEnvelope = {
  format: typeof STORAGE_FORMAT;
  version: typeof STORAGE_VERSION;
  savedAt: number;
  expiresAt: number;
  recipe: ThemeRecipe;
};
// `discard` covers expired or impossible save times; `ignore` leaves unknown data untouched.
type StoredRecipe =
  | { kind: 'recipe'; recipe: ThemeRecipe; legacy: boolean }
  | { kind: 'ignore' }
  | { kind: 'discard' };

let snapshot: ThemeRecipe | null = null;
let snapshotText: string | null = null;
// Whether the snapshot came from, or was saved to, the global storage key.
let snapshotGlobal = false;
const listeners = new Set<() => void>();

// Original inline values of every custom property this store has written.
const ownedStyles = new Map<HTMLElement, Map<string, OwnedValue>>();
let ownedAttribute: { element: HTMLElement; value: string | null } | null = null;

let initializeCount = 0;
let detach: (() => void) | null = null;

/** A document that owns its theme mode, such as an isolated preview, instead of the global theme. */
export type ThemeBuilderModeOwner = { getMode: () => ThemeMode; eventName: string };
// The first mode owner keeps the document until the final dispose.
let modeOwner: ThemeBuilderModeOwner | null = null;

function currentMode(): ThemeMode {
  const owned = modeOwner?.getMode();
  return isThemeMode(owned) ? owned : getThemeSnapshot();
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function parseText(text: string, parse: RecipeParser = parseRecipe): ParsedRecipe {
  if (byteLength(text) > MAX_RECIPE_BYTES) {
    return { ok: false, error: 'Theme recipe exceeds the 32 KiB limit.' };
  }
  return parse(text);
}

function serialize(input: unknown, parse?: RecipeParser): ParsedRecipe {
  let text: unknown;
  try {
    text = JSON.stringify(input);
  } catch {
    return { ok: false, error: 'Theme recipe is not serializable JSON.' };
  }
  if (typeof text !== 'string') {
    return { ok: false, error: 'Theme recipe must be a JSON object.' };
  }
  return parseText(text, parse);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function restoreProperty(element: HTMLElement, name: string, original: OwnedValue): void {
  if (original.value === '') element.style.removeProperty(name);
  else element.style.setProperty(name, original.value, original.priority);
}

function restoreOwnedStyles(): void {
  for (const [element, properties] of ownedStyles) {
    for (const [name, original] of properties) restoreProperty(element, name, original);
  }
  ownedStyles.clear();
  if (ownedAttribute) {
    const { element, value } = ownedAttribute;
    if (value === null) element.removeAttribute(BUILDER_ATTRIBUTE);
    else element.setAttribute(BUILDER_ATTRIBUTE, value);
    ownedAttribute = null;
  }
}

function writeVariables(element: HTMLElement, variables: Record<string, string>): void {
  let owned = ownedStyles.get(element);
  if (!owned) {
    owned = new Map();
    ownedStyles.set(element, owned);
  }
  for (const [name, original] of owned) {
    if (!(name in variables)) {
      restoreProperty(element, name, original);
      owned.delete(name);
    }
  }
  for (const [name, value] of Object.entries(variables)) {
    if (!name.startsWith('--')) continue;
    if (!owned.has(name)) {
      owned.set(name, {
        value: element.style.getPropertyValue(name),
        priority: element.style.getPropertyPriority(name),
      });
    }
    element.style.setProperty(name, String(value), 'important');
  }
}

function applyDocument(recipe: ThemeRecipe, mode: ThemeMode = currentMode()): void {
  if (typeof document === 'undefined') return;
  const { variables } = resolveThemeBuilder(recipe, mode);
  const root = document.documentElement;
  const body = document.body;
  // Body carries docs brand and accessibility rules that override html values.
  writeVariables(root, variables);
  if (body) {
    writeVariables(body, variables);
    if (!ownedAttribute || ownedAttribute.element !== body) {
      ownedAttribute = { element: body, value: body.getAttribute(BUILDER_ATTRIBUTE) };
    }
    body.setAttribute(BUILDER_ATTRIBUTE, 'active');
  }
}

function commit(recipe: ThemeRecipe, shared: boolean): void {
  snapshotGlobal = shared;
  const text = JSON.stringify(recipe);
  if (text !== snapshotText) {
    snapshot = deepFreeze(recipe);
    snapshotText = text;
    applyDocument(snapshot);
    notify();
    return;
  }
  if (snapshot) applyDocument(snapshot);
}

function clearSnapshot(): void {
  restoreOwnedStyles();
  snapshotGlobal = false;
  if (snapshot === null) return;
  snapshot = null;
  snapshotText = null;
  notify();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function persist(recipe: ThemeRecipe): boolean {
  try {
    const savedAt = Math.floor(Date.now());
    const envelope: StoredEnvelope = {
      format: STORAGE_FORMAT,
      version: STORAGE_VERSION,
      savedAt,
      expiresAt: savedAt + THEME_BUILDER_RETENTION_MS,
      recipe,
    };
    window.localStorage.setItem(THEME_BUILDER_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    // The applied theme still works when browser storage is unavailable.
    return false;
  }
}

function readStoredText(text: string, now: number): StoredRecipe {
  if (byteLength(text) > MAX_STORED_BYTES) return { kind: 'ignore' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'ignore' };
  }
  if (!isRecord(parsed) || !Object.prototype.hasOwnProperty.call(parsed, 'format')) {
    // Raw recipes saved before retention are still accepted and upgraded, never reset.
    const result = parseText(text, parseStoredRecipe);
    return result.ok ? { kind: 'recipe', recipe: result.recipe, legacy: true } : { kind: 'ignore' };
  }
  const { format, version, savedAt, expiresAt, recipe } = parsed;
  // A newer storage format is left for the code that wrote it.
  // Envelopes saved under the previous namespace keep their format name and save time.
  const knownFormat = format === STORAGE_FORMAT || format === formerNamespaceName(STORAGE_FORMAT);
  if (!knownFormat || version !== STORAGE_VERSION) return { kind: 'ignore' };
  if (
    Object.keys(parsed).length !== 5 ||
    typeof savedAt !== 'number' ||
    typeof expiresAt !== 'number' ||
    !Number.isSafeInteger(savedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt - savedAt !== THEME_BUILDER_RETENTION_MS ||
    !Number.isFinite(now) ||
    savedAt > now + MAX_CLOCK_SKEW_MS ||
    now >= expiresAt
  )
    return { kind: 'discard' };
  // The envelope keeps its save time; a migrated recipe never extends the retention window.
  const result = serialize(recipe, parseStoredRecipe);
  return result.ok ? { kind: 'recipe', recipe: result.recipe, legacy: false } : { kind: 'ignore' };
}

function readStoredRecipe(): StoredRecipe | null {
  let text: string | null;
  try {
    text = readMigratedItem(window.localStorage, THEME_BUILDER_STORAGE_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  const stored = readStoredText(text, Date.now());
  if (stored.kind === 'discard') {
    try {
      // Both keys go, so an older previous-namespace recipe cannot return on the next load.
      removeMigratedItem(window.localStorage, THEME_BUILDER_STORAGE_KEY);
    } catch {
      // The discarded recipe is still not applied when storage cannot be cleared.
    }
  } else if (stored.kind === 'recipe' && stored.legacy) {
    // Starts the retention window for a recipe saved before retention existed.
    persist(stored.recipe);
  }
  return stored;
}

function isLocalStorageEvent(event: StorageEvent): boolean {
  try {
    return event.storageArea === null || event.storageArea === window.localStorage;
  } catch {
    return true;
  }
}

function attach(owner: ThemeBuilderModeOwner | null): () => void {
  const themeEvent = owner?.eventName ?? THEME_EVENT;
  if (owner) {
    // A mode owner keeps its recipe in memory only and never inherits the global recipe.
    if (snapshotGlobal) clearSnapshot();
    else if (snapshot) applyDocument(snapshot);
  } else {
    const stored = readStoredRecipe();
    if (stored?.kind === 'recipe') commit(stored.recipe, true);
    // Expired or impossible save times return the defaults instead of an older in-memory theme.
    else if (stored?.kind === 'discard') clearSnapshot();
    else if (snapshot) applyDocument(snapshot);
  }

  const onThemeChange = () => {
    if (snapshot) applyDocument(snapshot);
  };
  const onStorage = (event: StorageEvent) => {
    if (!isLocalStorageEvent(event)) return;
    if (event.key === null) {
      clearSnapshot();
      return;
    }
    if (event.key === THEME_STORAGE_KEY) {
      // A mode owner decides its own mode; the shared-origin global theme cannot recolor it.
      if (!owner && snapshot && isThemeMode(event.newValue))
        applyDocument(snapshot, event.newValue);
      return;
    }
    if (event.key !== THEME_BUILDER_STORAGE_KEY) return;
    if (event.newValue === null) {
      clearSnapshot();
      return;
    }
    // Malformed, expired or future cross-tab data is ignored; the current theme stays active.
    const stored = readStoredText(event.newValue, Date.now());
    if (stored.kind === 'recipe') commit(stored.recipe, true);
  };

  window.addEventListener(themeEvent, onThemeChange);
  // Global storage events never reach a mode owner's memory-local recipe.
  if (!owner) window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(themeEvent, onThemeChange);
    window.removeEventListener('storage', onStorage);
    restoreOwnedStyles();
  };
}

export function getThemeBuilderSnapshot(): ThemeRecipe | null {
  return snapshot;
}

export function getServerThemeBuilderSnapshot(): null {
  return null;
}

export function subscribeThemeBuilder(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function applyThemeBuilder(recipe: ThemeRecipe): ThemeBuilderResult {
  const result = serialize(recipe);
  if (!result.ok) return { ok: false, error: result.error };
  // A mode owner's recipe stays in memory and is never written to global storage.
  const shared = modeOwner === null;
  commit(result.recipe, shared);
  const persisted = shared && typeof window !== 'undefined' && persist(result.recipe);
  return { ok: true, persisted };
}

export function resetThemeBuilder(): void {
  // A mode owner resets only its memory-local recipe.
  if (modeOwner === null && typeof window !== 'undefined') {
    try {
      // The approved previous key goes too, so the next load cannot restore an older recipe.
      removeMigratedItem(window.localStorage, THEME_BUILDER_STORAGE_KEY);
    } catch {
      // Resetting the document still works when browser storage is unavailable.
    }
  }
  clearSnapshot();
}

/** Without an owner the document follows the global theme. A mode owner replaces an earlier
    ownerless attachment, so effect order cannot hand an isolated document to the global theme;
    later callers, with or without an owner, never replace it before the final dispose. */
export function initializeThemeBuilder(owner?: ThemeBuilderModeOwner): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  initializeCount += 1;
  if (owner && !modeOwner) {
    detach?.();
    modeOwner = owner;
    detach = attach(owner);
  } else if (initializeCount === 1) detach = attach(null);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    initializeCount -= 1;
    if (initializeCount === 0) {
      detach?.();
      detach = null;
      modeOwner = null;
    }
  };
}
