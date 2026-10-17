/** Parent and preview document protocol. Only same-origin messages from the parent window on
    one channel and example id are accepted; types are allowlisted and strings bounded. Form
    state travels as plain key/value pairs restored through native setters, never as HTML. */
import { isPreviewOrientation, type PreviewOrientation } from '../data/preview-devices';
import type { ThemeMode } from '../theme';
import { isPreviewProfile, type PreviewProfile } from './profiles';

export const PREVIEW_CHANNEL = 'genux-preview';
const MAX_FIELDS = 200;
const MAX_KEY = 256;
const MAX_VALUE = 4000;
const MAX_REVISION = 1e9;

/** Navigation revision of a preview URL query; anything but a plain integer 0..1e9 reads 0. */
export function previewRevision(search: string): number {
  const raw = new URLSearchParams(search).get('revision') ?? '0';
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= MAX_REVISION && String(value) === raw
    ? value
    : 0;
}
const currentRevision = () =>
  typeof window === 'undefined' ? 0 : previewRevision(window.location.search);

export type PreviewField = { readonly key: string; readonly value: string | boolean };
export type PreviewCommand =
  | { type: 'theme'; mode: ThemeMode }
  | { type: 'orientation'; orientation: PreviewOrientation }
  | { type: 'grid'; on: boolean }
  | { type: 'snapshot' }
  | { type: 'restore'; fields: PreviewField[] }
  | { type: 'open-native-settings' }
  | { type: 'connect' }
  | { type: 'profile'; profile: PreviewProfile };
export type PreviewMessage =
  | { type: 'ready'; profile: PreviewProfile }
  | { type: 'snapshot'; fields: PreviewField[] }
  | { type: 'profile-failed'; profile: PreviewProfile };

const bounded = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

export function parsePreviewFields(value: unknown): PreviewField[] | null {
  if (!Array.isArray(value) || value.length > MAX_FIELDS) return null;
  const fields: PreviewField[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const { key, value: field } = item as Record<string, unknown>;
    if (!bounded(key, MAX_KEY) || !(typeof field === 'boolean' || bounded(field, MAX_VALUE)))
      return null;
    fields.push({ key, value: field });
  }
  return fields;
}

/** Commands from another navigation revision (absent reads 0) are stale and dropped. */
export function parsePreviewCommand(
  data: unknown,
  exampleId: string,
  revision = 0,
): PreviewCommand | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.channel !== PREVIEW_CHANNEL || message.id !== exampleId) return null;
  if ((message.revision ?? 0) !== revision) return null;
  const { mode, orientation, on, profile } = message;
  switch (message.type) {
    case 'theme':
      return mode === 'light' || mode === 'dark' ? { type: 'theme', mode } : null;
    case 'orientation':
      return isPreviewOrientation(orientation) ? { type: 'orientation', orientation } : null;
    case 'grid':
      return typeof on === 'boolean' ? { type: 'grid', on } : null;
    case 'snapshot':
      return { type: 'snapshot' };
    case 'connect':
      return { type: 'connect' };
    // Runtime profile switch; the document keeps its tree, so no form state travels.
    case 'profile':
      return isPreviewProfile(profile) ? { type: 'profile', profile } : null;
    case 'open-native-settings':
      return { type: 'open-native-settings' };
    case 'restore': {
      const fields = parsePreviewFields(message.fields);
      return fields ? { type: 'restore', fields } : null;
    }
    default:
      return null;
  }
}

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const skippedTypes = new Set(['password', 'file', 'hidden', 'submit', 'reset', 'button', 'image']);
const checkable = (element: FieldElement): element is HTMLInputElement =>
  element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio');

/** React useId values (:r0:, «r0», _R_1_, _r_1_) differ between profile documents. */
const generatedId = /[:«»]|^_[rR]_/;

/** Native fields keyed by type plus a stable name, accessible name, label or authored id;
    generated React ids are never keys. Otherwise unlabelled fields keep their document order
    under the bare type, so no label is invented. Repeats get #n. */
function fieldsOf(root: ParentNode): [string, FieldElement][] {
  const counts = new Map<string, number>();
  const fields: [string, FieldElement][] = [];
  for (const element of root.querySelectorAll<FieldElement>('input, select, textarea')) {
    if (skippedTypes.has(element.type) || element.disabled || fields.length >= MAX_FIELDS) continue;
    const name =
      element.name ||
      element.getAttribute('aria-label')?.trim() ||
      element.labels?.[0]?.textContent?.trim() ||
      (generatedId.test(element.id) ? '' : element.id);
    const base = `${element.type}|${name}`.slice(0, MAX_KEY - 6);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    fields.push([count ? `${base}#${count}` : base, element]);
  }
  return fields;
}

export function snapshotFields(root: ParentNode | null): PreviewField[] {
  return root
    ? fieldsOf(root).map(([key, element]) => ({
        key,
        value: checkable(element) ? element.checked : element.value.slice(0, MAX_VALUE),
      }))
    : [];
}

/** Restores through native setters and input/change events so React sees user-like edits. */
export function restoreFields(root: ParentNode | null, fields: readonly PreviewField[]): void {
  if (!root) return;
  const elements = new Map(fieldsOf(root));
  for (const { key, value } of fields) {
    const element = elements.get(key);
    if (!element) continue;
    if (checkable(element)) {
      if (typeof value === 'boolean' && element.checked !== value) element.click();
      continue;
    }
    if (typeof value !== 'string' || element.value === value) continue;
    const prototype = Object.getPrototypeOf(element) as object;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function installPreviewBridge(
  exampleId: string,
  handle: (command: PreviewCommand) => void,
): () => void {
  if (typeof window === 'undefined' || window.parent === window) return () => {};
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const command = parsePreviewCommand(event.data, exampleId, currentRevision());
    if (command) handle(command);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

export function postToParent(exampleId: string, message: PreviewMessage): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage(
    { channel: PREVIEW_CHANNEL, id: exampleId, revision: currentRevision(), ...message },
    window.location.origin,
  );
}
