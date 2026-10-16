import type { LayoutModule } from './delivery';
import type { LayoutProfile } from './policy';

const styleAttribute = 'data-adaptive-layout-style';
const noop = () => {};

/** A layout module that installs its own compiled CSS before the profile attach runs. */
export type StyledLayoutModule = Readonly<
  LayoutModule & { cssText: string; attach: (root: HTMLElement) => () => void }
>;

/**
 * One style element per profile in the document that owns root. It stays after cleanup: the CSS
 * is scoped to the profile class, so a later attach in the same document reuses it.
 */
function installLayoutStyle(root: HTMLElement, profile: LayoutProfile, cssText: string): void {
  const doc = root.ownerDocument;
  for (const style of doc.querySelectorAll(`style[${styleAttribute}]`)) {
    if (style.getAttribute(styleAttribute) !== profile) continue;
    if (style.textContent !== cssText) style.textContent = cssText;
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(styleAttribute, profile);
  style.textContent = cssText;
  (doc.head ?? doc.documentElement).append(style);
}

/**
 * Wraps a profile entry with the compiled CSS of its own `?inline` stylesheet import. Only build
 * output is accepted here; generated or AI-supplied CSS never reaches this helper.
 */
export function withLayoutStyles(module: LayoutModule, cssText: string): StyledLayoutModule {
  if (typeof cssText !== 'string' || cssText.trim() === '')
    throw new Error(`Layout module ${module.profile} has no compiled CSS`);
  const original = module.attach;
  const attach = (root: HTMLElement): (() => void) => {
    installLayoutStyle(root, module.profile, cssText);
    return original?.(root) ?? noop;
  };
  return Object.freeze({ ...module, cssText, attach });
}
