import { readMigratedItem } from '../storage-migration';

// Component page behaviour for pages/components/[slug].astro: four tabs over the eight
// server-rendered sections, active-tab filtering of the existing section and contents links,
// copy as Markdown and the shared package manager. Without it every section stays readable.
const defaultTab = 'examples';
const managerKey = 'genux-package-manager';

function repository(raw: unknown): string | undefined {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    return undefined;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  return url.protocol === 'https:' && url.hostname === 'github.com' && parts.length === 2
    ? `${url.origin}/${parts.join('/')}`
    : undefined;
}
// Edit links need a well-formed ref: slash-separated segments of letters, digits, `_`, `.` and
// `-`, none starting with `.` or `-`, holding `..` or ending in `.` or `.lock`.
const branchSegment = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const validSegment = (part: string) =>
  branchSegment.test(part) && !part.includes('..') && !/[.](lock)?$/.test(part);
function branch(raw: unknown): string | undefined {
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name.split('/').every(validSegment) ? name : undefined;
}
/** Public repository for edit, issue, GitHub and clone links: the canonical GenUX repository
 * and its main branch unless a valid PUBLIC_GENUX_REPOSITORY_* override replaces them. */
export const repositoryUrl: string =
  repository(import.meta.env.PUBLIC_GENUX_REPOSITORY_URL) ?? 'https://github.com/atonota/genux';
export const repositoryBranch: string =
  branch(import.meta.env.PUBLIC_GENUX_REPOSITORY_BRANCH) ?? 'main';

const text = (node: Element) => (node.textContent ?? '').trim().split(/\s+/).join(' ');
const prefixes: Record<string, string> = { h1: '# ', h2: '## ', h3: '### ', li: '- ' };
// Table cells escape backslashes and pipes so union types in API columns stay one cell each;
// text() already folds line breaks into single spaces.
const cell = (node: Element) => text(node).replace(/[\\|]/g, '\\$&');

/** Markdown of the whole article, every tab included; live demos and controls are skipped. */
function toMarkdown(article: HTMLElement): string {
  const blocks: string[] = [];
  const nodes = article.querySelectorAll<HTMLElement>(
    'h1, .lead, [data-doc-section] :is(h2, h3, p, li, pre, tr)',
  );
  for (const node of nodes) {
    if (node.parentElement?.closest('pre, li, tr, [data-doc-demo], [data-install-managers]'))
      continue;
    if (node.localName === 'pre') blocks.push('```\n' + (node.textContent ?? '').trim() + '\n```');
    else if (node.localName === 'tr') {
      const cells = [...node.children].map(cell);
      const row = `| ${cells.join(' | ')} |`;
      if (node.parentElement?.localName === 'thead')
        blocks.push(row + '\n|' + ' --- |'.repeat(cells.length));
      else blocks.push((blocks.pop() ?? '') + '\n' + row);
    } else blocks.push((prefixes[node.localName] ?? '') + text(node));
  }
  return blocks.join('\n\n') + '\n';
}

/** Wires tabs, link filtering, copy and install choice; the disposer restores the SSR state. */
export function installDocsPage(root: Document): () => void {
  const view = root.defaultView;
  const article = root.querySelector<HTMLElement>('[data-component-detail]');
  const list = article?.querySelector<HTMLElement>('[data-doc-tabs]');
  if (!view || !article || !list || article.hasAttribute('data-doc-page-ready')) return () => {};

  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[data-doc-tab]')];
  const panels = [...article.querySelectorAll<HTMLElement>('[data-doc-panel]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-doc-nav] a[href^="#"]')];
  const install = article.querySelector<HTMLElement>('[data-install]');
  const choices = [
    ...(install?.querySelectorAll<HTMLButtonElement>('[data-install-manager]') ?? []),
  ];
  const commands = [...(install?.querySelectorAll<HTMLElement>('[data-install-command]') ?? [])];
  const controller = new AbortController();
  const { signal } = controller;

  const hashId = () => {
    try {
      return decodeURIComponent(view.location.hash.slice(1));
    } catch {
      return '';
    }
  };
  // The tab that owns a section id; legacy section hashes and contents links resolve here.
  const groupOf = (id: string) =>
    id
      ? root.getElementById(id)?.closest<HTMLElement>('[data-doc-panel]')?.dataset.docPanel
      : undefined;
  const activate = (group: string) => {
    for (const tab of tabs) {
      const selected = tab.dataset.docTab === group;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.docPanel !== group;
      panel.inert = panel.hidden;
    }
    for (const link of links) link.hidden = groupOf(link.hash.slice(1)) !== group;
  };
  // A section hash wins over ?tab=; an unknown or missing tab falls back to Examples.
  const follow = () => {
    const id = hashId();
    const query = new URLSearchParams(view.location.search).get('tab');
    const named = tabs.find(tab => tab.dataset.docTab === query)?.dataset.docTab;
    activate(groupOf(id) ?? named ?? defaultTab);
    if (id) root.getElementById(id)?.scrollIntoView();
  };
  const select = (
    mode: 'pushState' | 'replaceState',
    tab: HTMLButtonElement | null | undefined,
  ) => {
    const group = tab?.dataset.docTab;
    if (!group) return;
    activate(group);
    const url = new URL(view.location.href);
    url.searchParams.set('tab', group);
    url.hash = '';
    view.history[mode](null, '', url);
  };
  const keys: Record<string, (index: number) => number> = {
    ArrowLeft: index => (index + tabs.length - 1) % tabs.length,
    ArrowRight: index => (index + 1) % tabs.length,
    Home: () => 0,
    End: () => tabs.length - 1,
  };

  list.addEventListener(
    'click',
    event =>
      select('pushState', (event.target as Element).closest<HTMLButtonElement>('[data-doc-tab]')),
    { signal },
  );
  list.addEventListener(
    'keydown',
    event => {
      const move = keys[event.key];
      const index = tabs.indexOf(event.target as HTMLButtonElement);
      if (!move || index < 0) return;
      event.preventDefault();
      const tab = tabs[move(index)];
      select('replaceState', tab);
      tab?.focus();
    },
    { signal },
  );
  view.addEventListener('hashchange', follow, { signal });
  view.addEventListener('popstate', follow, { signal });

  const clipboard = view.navigator.clipboard as Clipboard | undefined;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-doc-copy-markdown]')) {
    if (!clipboard) break;
    const status = button.parentElement?.querySelector('[data-doc-copy-status]');
    const report = (message: string) => {
      const span = root.createElement('span');
      span.dataset.i18n = message;
      span.textContent = message;
      status?.replaceChildren(span);
    };
    button.hidden = false;
    button.addEventListener(
      'click',
      () =>
        void clipboard.writeText(toMarkdown(article)).then(
          () => report('Markdown copied.'),
          () => report('Copy failed.'),
        ),
      { signal },
    );
  }

  const choose = (manager: string) => {
    const known = choices.some(item => item.dataset.installManager === manager) ? manager : 'npm';
    for (const item of choices)
      item.setAttribute('aria-pressed', String(item.dataset.installManager === known));
    for (const item of commands) item.hidden = item.dataset.installCommand !== known;
  };
  if (install && choices.length) {
    let stored = '';
    try {
      stored = readMigratedItem(view.localStorage, managerKey) ?? '';
    } catch {
      // Blocked storage keeps npm for this page.
    }
    install.querySelector<HTMLElement>('[data-install-managers]')?.removeAttribute('hidden');
    install.addEventListener(
      'click',
      event => {
        const manager = (event.target as Element).closest<HTMLElement>('[data-install-manager]')
          ?.dataset.installManager;
        if (!manager) return;
        choose(manager);
        try {
          view.localStorage.setItem(managerKey, manager);
        } catch {
          // The choice still applies to this page.
        }
      },
      { signal },
    );
    choose(stored);
  }

  // Sections become tabpanels named by their tab and heading only while the tabs work; the
  // server markup keeps its plain labelled sections and the disposer restores them.
  const original = panels.map(panel => ({
    panel,
    role: panel.getAttribute('role'),
    labelledBy: panel.getAttribute('aria-labelledby'),
  }));
  for (const { panel, labelledBy } of original) {
    const owner = tabs.find(tab => tab.dataset.docTab === panel.dataset.docPanel);
    if (!owner?.id) continue;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', [owner.id, labelledBy].filter(Boolean).join(' '));
  }
  const restore = (node: Element, name: string, value: string | null) =>
    value === null ? node.removeAttribute(name) : node.setAttribute(name, value);

  list.hidden = false;
  article.setAttribute('data-doc-page-ready', '');
  follow();

  return () => {
    controller.abort();
    for (const node of [...panels, ...links, ...commands]) node.hidden = false;
    for (const panel of panels) panel.inert = false;
    for (const { panel, role, labelledBy } of original) {
      restore(panel, 'role', role);
      restore(panel, 'aria-labelledby', labelledBy);
    }
    list.hidden = true;
    article.removeAttribute('data-doc-page-ready');
  };
}
