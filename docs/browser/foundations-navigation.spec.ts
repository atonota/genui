import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

// Uses the existing docs service. Screenshot names carry the source stage so RED and GREEN never overwrite.
const BASE_URL = process.env.GENUX_DOCS_URL ?? 'http://127.0.0.1:4324';
const STAGE = (process.env.GENUX_SOURCE_STAGE ?? 'unstaged').replace(/[^a-z0-9-]+/gi, '-');
const DESKTOP = { width: 1280, height: 800 };
const NARROW = { width: 320, height: 720 };
const THEMES = ['light', 'dark'] as const;

type NavLink = { label: string; path: string };
type NavGroup = { name: string | null; links: NavLink[] };

const FOUNDATION_GROUPS: NavGroup[] = [
  {
    name: 'Start',
    links: [
      { label: 'Overview', path: '/' },
      { label: 'Component catalog', path: '/components/' },
      { label: 'Getting started', path: '/getting-started/' },
      { label: 'Guides', path: '/guides/' },
    ],
  },
  {
    name: 'Foundations',
    links: [
      { label: 'Foundations', path: '/foundations/' },
      { label: 'Design tokens', path: '/tokens/' },
      { label: 'UX standards', path: '/standards/' },
      { label: 'GenUX', path: '/ai-ui/' },
      { label: 'Adaptive UI', path: '/adaptive/' },
      { label: 'Tools', path: '/tools/' },
      { label: 'Color system', path: '/color-system/' },
      { label: 'Theme Builder', path: '/theme-builder/' },
    ],
  },
  {
    name: 'Project',
    links: [
      { label: 'Project', path: '/project/' },
      { label: 'Decision log', path: '/decisions/' },
      { label: 'Documentation standard', path: '/documentation/' },
      { label: 'URL policy', path: '/url-policy/' },
      { label: 'SEO policy', path: '/seo-policy/' },
    ],
  },
];
const FOUNDATION_PATHS = FOUNDATION_GROUPS.flatMap(group => group.links.map(link => link.path));
// Foundations and Project pages own the link check; Start pages are covered by the route check.
const LINKED_PAGES = FOUNDATION_GROUPS.slice(1).flatMap(group =>
  group.links.map(link => link.path),
);

// Anchors published by the current /token-standards/ page and their declared destinations:
// normative rules move to /standards/, token tables move to /tokens/.
const LEGACY_TOKEN_GROUPS = [
  'colors',
  'border',
  'spacing',
  'insets',
  'radius',
  'size',
  'typography',
  'shadow',
  'density',
  'surface',
  'overlay',
];
const LEGACY_ANCHORS: [string, string][] = [
  ['token-catalog', '/tokens/'],
  ...LEGACY_TOKEN_GROUPS.map((group): [string, string] => [`token-group-${group}`, '/tokens/']),
  ['using-tokens', '/tokens/'],
  ['measurement-scales', '/standards/'],
  ['surface-states', '/standards/'],
  ['motion-focus', '/standards/'],
  ['layers', '/standards/'],
  ['overlay-standard', '/standards/'],
];

const url = (path: string) => new URL(path, BASE_URL).href;
const navigation = (page: Page) => page.locator('#navigation nav');

// Reads the menu in document order: every link belongs to the heading before it.
const readNavGroups = (page: Page) =>
  navigation(page).evaluate(nav => {
    const groups: NavGroup[] = [];
    const text = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const items = nav.querySelectorAll('h1, h2, h3, h4, h5, h6, [role=heading], a[href]');
    for (const element of Array.from(items)) {
      if (element instanceof HTMLAnchorElement) {
        if (groups.length === 0) groups.push({ name: null, links: [] });
        const path = new URL(element.href).pathname;
        groups[groups.length - 1]!.links.push({ label: text(element), path });
      } else {
        groups.push({ name: text(element), links: [] });
      }
    }
    return groups;
  });

async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  const toggle = page.getByRole('switch', { name: 'Dark theme' });
  const checked = String(theme === 'dark');
  if ((await toggle.getAttribute('aria-checked')) !== checked) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', checked);
}

async function captureMenu(testInfo: TestInfo, name: string, target: Locator) {
  const path = testInfo.outputPath(`foundations-navigation-${STAGE}-${name}.png`);
  await target.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(`${STAGE}-${name}`, { path, contentType: 'image/png' });
}

// The layout script filters nav groups on initialization and every locale change; readNavGroups
// also reads hidden nodes, so the foundation groups must be checked for real visibility.
async function expectFoundationGroupsVisible(page: Page, groups: NavGroup[]) {
  await expect(page.locator('html[data-input-modality]')).toHaveCount(1);
  for (const group of groups) {
    const name = group.name ?? '';
    await expect(
      navigation(page).getByRole('heading', { name, exact: true }),
      `${name} heading visible`,
    ).toBeVisible();
    for (const link of group.links) {
      await expect(
        navigation(page).getByRole('link', { name: link.label, exact: true }),
        `${name}: ${link.label} visible`,
      ).toBeVisible();
    }
  }
}

test('foundation menu groups, routes and locales follow the information architecture', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize(DESKTOP);
  await page.goto(url('/'));

  // Capture before structural assertions so the RED stage keeps every screenshot.
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await captureMenu(testInfo, `desktop-${theme}`, navigation(page));
  }
  await page.setViewportSize(NARROW);
  const drawer = page.getByRole('dialog', { name: 'Documentation' });
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(drawer).toBeVisible();
    await captureMenu(testInfo, `320-${theme}`, drawer);
    await drawer.getByRole('button', { name: 'Close menu' }).click();
    await expect(drawer).toBeHidden();
  }
  await setTheme(page, 'light');
  await page.setViewportSize(DESKTOP);

  const english = await readNavGroups(page);
  expect(english.slice(0, FOUNDATION_GROUPS.length)).toEqual(FOUNDATION_GROUPS);
  await expectFoundationGroupsVisible(page, FOUNDATION_GROUPS);
  const componentGroups = english.slice(FOUNDATION_GROUPS.length);
  expect(componentGroups.length, 'component groups after Project').toBeGreaterThan(0);
  for (const group of componentGroups) {
    expect(group.name, 'component group heading').toBeTruthy();
    expect(group.links.length, `${group.name} links`).toBeGreaterThan(0);
    for (const link of group.links) {
      expect(link.path.startsWith('/components/'), `${group.name}: ${link.path}`).toBe(true);
    }
  }

  await page.getByRole('button', { name: /^TR/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  const turkish = await readNavGroups(page);
  const pathsOf = (groups: NavGroup[]) => groups.map(group => group.links.map(link => link.path));
  expect(pathsOf(turkish)).toEqual(pathsOf(english));
  for (const group of turkish) {
    expect(group.name, 'Turkish group heading').toBeTruthy();
    for (const link of group.links) {
      expect(link.label, `Turkish label for ${link.path}`).toBeTruthy();
    }
  }
  FOUNDATION_GROUPS.forEach((group, index) => {
    expect(turkish[index]?.name, `${group.name} heading in Turkish`).not.toBe(group.name);
  });
  await expectFoundationGroupsVisible(page, turkish.slice(0, FOUNDATION_GROUPS.length));
  await page.getByRole('button', { name: /^EN/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await readNavGroups(page)).toEqual(english);
  await expectFoundationGroupsVisible(page, FOUNDATION_GROUPS);

  for (const path of FOUNDATION_PATHS) {
    const response = await page.goto(url(path));
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('h1'), `${path} h1`).toHaveCount(1);
    await expectFoundationGroupsVisible(page, FOUNDATION_GROUPS);
    const current = navigation(page).locator('a[aria-current=page]');
    await expect(current, `${path} current menu item`).toHaveCount(1);
    const currentHref = await current.evaluate(link => (link as HTMLAnchorElement).href);
    expect(new URL(currentHref).pathname, `${path} current menu item`).toBe(path);
  }
});

test('legacy token standards route and anchors resolve to their declared destinations', async ({
  page,
}) => {
  await page.goto(url('/token-standards/'), { waitUntil: 'commit' });
  await page.waitForURL(next => next.pathname === '/tokens/' && next.hash === '', {
    timeout: 5_000,
  });
  await expect(page.locator('h1')).toHaveCount(1);

  for (const [anchor, path] of LEGACY_ANCHORS) {
    await page.goto(url(`/token-standards/#${anchor}`), { waitUntil: 'commit' });
    await page.waitForURL(next => next.pathname === path && next.hash === `#${anchor}`, {
      timeout: 5_000,
    });
    // A matching URL is not enough: the destination must contain the target and scroll to it.
    const target = page.locator(`#${anchor}`);
    await expect(target, `${anchor} on ${path}`).toHaveCount(1);
    await expect(target, `${anchor} on ${path}`).toBeInViewport();
  }
});

test('foundation and project pages link only to resolvable internal targets', async ({ page }) => {
  const statuses = new Map<string, number>();
  for (const pagePath of LINKED_PAGES) {
    const response = await page.goto(url(pagePath));
    expect(response?.status(), pagePath).toBe(200);
    const here = new URL(page.url());
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href));
    for (const href of new Set(hrefs)) {
      const target = new URL(href);
      // External destinations are never fetched.
      if (target.origin !== here.origin) continue;
      const resource = `${target.origin}${target.pathname}${target.search}`;
      if (!statuses.has(resource)) {
        statuses.set(resource, (await page.request.get(resource)).status());
      }
      expect.soft(statuses.get(resource), `${pagePath} links to ${href}`).toBe(200);
      if (target.pathname === here.pathname && target.hash.length > 1) {
        const id = decodeURIComponent(target.hash.slice(1));
        const exists = await page.evaluate(
          targetId => document.getElementById(targetId) !== null,
          id,
        );
        expect.soft(exists, `${pagePath} fragment ${target.hash}`).toBe(true);
      }
    }
  }
});
