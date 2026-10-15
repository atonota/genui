import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

/** Add Space activation to rc-collapse headers; native Enter stays unchanged. */
export function toggleCollapseOnSpace(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== ' ' || !(event.target instanceof Element)) return;
  const header = event.target.closest(
    '[aria-expanded][role="tab"], [aria-expanded][role="button"]',
  );
  // Interactive descendants retain their own keyboard behavior.
  if (
    !(header instanceof HTMLElement) ||
    header !== event.target ||
    header.getAttribute('aria-disabled') === 'true'
  )
    return;
  event.preventDefault();
  if (event.repeat) return;
  header.click();
}
