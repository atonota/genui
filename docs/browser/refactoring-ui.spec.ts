import { expect, test, type Locator, type Page } from '@playwright/test';

// Refactoring UI delivery: Empty State and Avatar. Root acceptance runs Chromium at 320 CSS px.
const emptyRoute = '/components/empty-state/';
const avatarRoute = '/components/avatar/';
const recordWorkspaceRoute = '/components/record-workspace/';

async function open(page: Page, route: string, waitUntil: 'load' | 'domcontentloaded' = 'load') {
  await page.setViewportSize({ width: 320, height: 720 });
  const response = await page.goto(route, { waitUntil });
  // Before integration the route is genuinely absent; that is the expected red state.
  expect(response?.status(), `${route} must be published`).toBe(200);
}

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

const expectNoPageOverflow = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);

async function evidence(name: string, target: Page | Locator) {
  await test.info().attach(name, { body: await target.screenshot(), contentType: 'image/png' });
}

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element === document.activeElement)) return;
  }
  throw new Error('Target is not reachable with Tab');
}

// Painted thin pseudo-element lines inside the control: the only allowed focus cue.
const focusLines = (target: Locator) =>
  target.evaluate(root =>
    [root, ...root.querySelectorAll('*')].flatMap(element =>
      (['::before', '::after'] as const).filter(pseudo => {
        const style = getComputedStyle(element, pseudo);
        const thin = Math.min(parseFloat(style.width), parseFloat(style.height));
        const long = Math.max(parseFloat(style.width), parseFloat(style.height));
        return (
          !['none', 'normal'].includes(style.content) &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          thin >= 1 &&
          thin <= 4 &&
          long >= 8
        );
      }),
    ),
  );

// Outline, shadow and border must not change on focus: no enclosing ring.
const enclosure = (target: Locator) =>
  target.evaluate(element => {
    const style = getComputedStyle(element);
    return [style.outlineStyle, style.outlineWidth, style.boxShadow, style.borderColor];
  });

test('first-use empty state creates a real local record from the keyboard', async ({ page }) => {
  await open(page, emptyRoute);
  const firstUse = region(page, 'First-use collection');
  const empty = firstUse.getByRole('status').and(firstUse.locator('[data-empty-state=empty]'));
  // Actions sit outside the live description, so look them up from the named section.
  const create = firstUse.getByRole('button', { name: 'Create first record', exact: true });
  await expect(empty).toBeVisible();
  // Filters and the table appear only once a record exists.
  await expect(firstUse.getByRole('table')).toHaveCount(0);
  await expect(firstUse.getByRole('searchbox')).toHaveCount(0);
  await expect(firstUse.getByRole('textbox')).toHaveCount(0);
  await expectNoPageOverflow(page);
  await evidence('first-use-empty-320', firstUse);

  const resting = await enclosure(create);
  expect(await focusLines(create)).toEqual([]);
  await tabTo(page, create);
  expect(await enclosure(create)).toEqual(resting);
  expect(await focusLines(create)).toHaveLength(1);

  await page.keyboard.press('Enter');
  const result = firstUse.getByText('First local record created', { exact: true });
  await expect(result).toBeVisible();
  await expect(result).toBeFocused();
  // Moved focus is shown immediately as an underline, never an outline.
  expect(
    await result.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.textDecorationLine, style.outlineStyle];
    }),
  ).toEqual(['underline', 'none']);
  await expect(empty).toHaveCount(0);
  await expect(
    firstUse.getByRole('listitem').filter({ hasText: 'Atlas research brief' }),
  ).toBeVisible();
  // The created collection keeps its owning styles: closed settings collapse, records lay out.
  const tools = firstUse.locator('.kit-tools-disclosure');
  await expect(tools).toHaveCount(1);
  await expect(tools).toHaveAttribute('data-open', 'false');
  await expect(tools).toHaveCSS('display', 'grid');
  await expect(tools).toHaveCSS('grid-template-rows', '0px');
  await expect
    .poll(async () => (await tools.locator('.workspace-disclosure-clip').boundingBox())?.height)
    .toBe(0);
  await expect(firstUse.locator('.kit-collection-layout')).toHaveCSS('display', 'grid');
  const records = firstUse.locator(':is(.kit-record-list, .kit-record-cards)').first();
  await expect(records).toHaveCSS('display', 'grid');
  await expect(records).toHaveCSS('list-style-type', 'none');
  await expectNoPageOverflow(page);
});

test('filtered, unavailable and order collections recover real records', async ({ page }) => {
  await open(page, emptyRoute);

  const filtered = region(page, 'Filtered collection');
  const query = filtered.getByLabel('Search example records', { exact: true });
  const brief = filtered.getByText('Atlas research brief', { exact: true });
  await expect(brief).toBeVisible();
  await query.fill('zz-no-such-record');
  const noMatch = filtered.getByRole('status').and(filtered.locator('[data-empty-state=no-match]'));
  await expect(noMatch).toBeVisible();
  await expect(brief).toBeHidden();
  await filtered.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(query).toHaveValue('');
  await expect(brief).toBeVisible();
  await expect(noMatch).toHaveCount(0);

  const unavailable = region(page, 'Unavailable collection');
  const failure = unavailable
    .getByRole('alert')
    .and(unavailable.locator('[data-empty-state=error]'));
  await expect(failure).toBeVisible();
  await expect(unavailable.getByRole('listitem')).toHaveCount(0);
  await unavailable.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(unavailable.getByText('Local records restored', { exact: true })).toBeVisible();
  await expect(failure).toHaveCount(0);
  await expect(
    unavailable.getByRole('listitem').filter({ hasText: 'Atlas research brief' }),
  ).toBeVisible();
  await expectNoPageOverflow(page);

  // The existing record workspace shows its no-match state through the native AntD Empty.
  await open(page, recordWorkspaceRoute);
  const orders = region(page, 'Orders');
  const rows = orders.getByRole('row');
  await expect.poll(() => rows.count()).toBeGreaterThan(1);
  const rowCount = await rows.count();
  const search = orders.getByLabel('Search records', { exact: true });
  await search.fill('zz-no-such-order');
  const nativeEmpty = orders.locator('.ant-empty').filter({ hasText: 'No matching records' });
  await expect(nativeEmpty).toBeVisible();
  await expect(orders.getByRole('heading', { name: 'No matching records' })).toBeVisible();
  await orders.getByRole('button', { name: 'Clear query and group scope', exact: true }).click();
  await expect(nativeEmpty).toHaveCount(0);
  await expect(search).toHaveValue('');
  await expect(rows).toHaveCount(rowCount);
  await expectNoPageOverflow(page);
});

test('avatars keep fixed boxes, decorative pairs and readable fallbacks', async ({ page }) => {
  let releaseImage = () => {};
  const imageGate = new Promise<void>(resolve => {
    releaseImage = resolve;
  });
  await page.route('**/atlas-avatar-missing-example.png', async route => {
    await imageGate;
    await route.fulfill({ status: 404, body: '' });
  });
  await open(page, avatarRoute, 'domcontentloaded');
  // Paired avatars are decorative; the adjacent visible name is the accessible text.
  const person = (name: string) => page.getByRole('listitem').filter({ hasText: name });
  const paired = (name: string) => person(name).locator('.atlas-avatar');
  const ada = paired('Ada Lovelace');
  const sam = paired('Sam Lee');
  const unknown = paired('Unknown person');
  // One avatar per person; duplicates must not hide behind first().
  for (const name of ['Alex', 'Ada Lovelace', 'Sam Lee', 'Unknown person']) {
    const item = paired(name);
    await expect(item).toHaveCount(1);
    await expect(item).toHaveAttribute('aria-hidden', 'true');
    await expect(item).not.toHaveAttribute('role', 'img');
  }
  for (const name of ['Ada Lovelace', 'Sam Lee', 'Unknown person']) {
    await expect(person(name).getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name, exact: true })).toHaveCount(0);
  }
  // A standalone avatar has no adjacent name, so it stays one named image.
  await expect(page.getByRole('img', { name: 'Grace Hopper', exact: true })).toHaveCount(1);

  // While the broken source is pending, the decorative image covers the fixed box.
  const pending = ada.locator('img');
  expect(await pending.evaluate(image => image.closest('[aria-hidden=true]') !== null)).toBe(true);
  await expect(pending).toHaveCSS('object-fit', 'cover');
  const pendingBox = await ada.boundingBox();
  expect(pendingBox).not.toBeNull();
  releaseImage();
  await expect(ada.getByText('AL', { exact: true })).toBeVisible();
  expect(await ada.boundingBox()).toEqual(pendingBox);
  await expect(ada.locator('img')).toHaveCount(0);
  await expect(sam.locator('img')).toHaveCount(0);

  for (const [item, initials] of [
    [ada, 'AL'],
    [sam, 'SL'],
  ] as const) {
    const label = item.getByText(initials, { exact: true });
    await expect(label).toBeVisible();
    const fontSize = await label.evaluate(element =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(14);
    const box = (await item.boundingBox())!;
    const text = (await label.boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThan(0.5);
    expect(text.width).toBeLessThanOrEqual(box.width);
  }
  await expect(unknown.getByText('?', { exact: true })).toBeVisible();
  await expect(unknown.getByText('UP', { exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectNoPageOverflow(page);
  expect(await ada.boundingBox()).toMatchObject({
    width: pendingBox!.width,
    height: pendingBox!.height,
  });
  await evidence('avatar-1440', page);
});
