// Documentation shell behaviour for the DocsShell.astro markup. The single aside.sidebar
// (navigation and note) stays in the shell grid from the 875px content breakpoint and moves
// into the body of the native modal menu Drawer below it, so the page never renders two
// copies and the desktop layout exposes no dialog. The query matches layout.css
// (54.6875rem = 875px).
const sidebarQuery = '(min-width: 54.6875rem)';
// Announces the opened Drawer to nav-state, which restores the list scroll synchronously.
const navShownEvent = 'atlas-docs-nav-shown';

/** Wires the menu Drawer; the returned disposer restores the server markup. */
export function installDocsShell(root: Document): () => void {
  const view = root.defaultView;
  const shell = root.querySelector<HTMLElement>('[data-docs-shell]');
  const toggle = shell?.querySelector<HTMLButtonElement>('[data-docs-menu-toggle]');
  const sidebar = shell?.querySelector<HTMLElement>('aside.sidebar');
  const drawer = root.getElementById(toggle?.getAttribute('aria-controls') ?? '');
  if (
    !view ||
    !shell ||
    !toggle ||
    !sidebar ||
    !(drawer instanceof HTMLDialogElement) ||
    shell.hasAttribute('data-docs-shell-ready')
  )
    return () => {};

  const close = drawer.querySelector<HTMLButtonElement>('[data-docs-menu-close]');
  const body = drawer.querySelector<HTMLElement>('[data-docs-drawer-body]') ?? drawer;
  const home = root.createComment('docs-navigation');
  const wide = view.matchMedia(sidebarQuery);
  const controller = new AbortController();
  const { signal } = controller;
  let returnFocus = true;
  sidebar.before(home);

  const openDrawer = () => {
    if (wide.matches || drawer.open) return;
    drawer.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    // The list has layout now; nav-state restores its scroll before focus moves into it.
    root.dispatchEvent(new view.CustomEvent(navShownEvent));
    close?.focus({ preventScroll: true });
  };
  const closeDrawer = (restoreFocus: boolean) => {
    if (!drawer.open) return;
    returnFocus = restoreFocus;
    drawer.close();
    toggle.setAttribute('aria-expanded', 'false');
  };
  // Moving a focused node blurs it, so the focused sidebar item is focused again after
  // the move; below the breakpoint that means reopening the Drawer around it.
  const place = () => {
    const active = root.activeElement;
    const focused = active instanceof HTMLElement && sidebar.contains(active) ? active : null;
    if (wide.matches) {
      closeDrawer(false);
      home.after(sidebar);
    } else {
      body.append(sidebar);
      if (focused) openDrawer();
    }
    focused?.focus({ preventScroll: true });
  };

  toggle.addEventListener(
    'click',
    () => {
      if (drawer.open) closeDrawer(true);
      else openDrawer();
    },
    { signal },
  );
  close?.addEventListener('click', () => closeDrawer(true), { signal });
  // Clicks on the dialog box itself outside its rectangle land on the backdrop.
  drawer.addEventListener(
    'click',
    event => {
      if (event.target !== drawer) return;
      const rect = drawer.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) closeDrawer(true);
    },
    { signal },
  );
  // Escape, the close button and the backdrop all end here.
  drawer.addEventListener(
    'close',
    () => {
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus && !wide.matches) toggle.focus();
      returnFocus = true;
    },
    { signal },
  );
  wide.addEventListener('change', place, { signal });
  shell.setAttribute('data-docs-shell-ready', '');
  place();

  return () => {
    controller.abort();
    if (drawer.open) drawer.close();
    home.replaceWith(sidebar);
    toggle.setAttribute('aria-expanded', 'false');
    shell.removeAttribute('data-docs-shell-ready');
  };
}
