import { expect, test } from '@playwright/test';

// Record workspace composition: the Orders customer reads as a person (decorative avatar
// beside the actual name, never the record ID) and numeric cells align to the end.
test('record workspace pairs the Orders customer with a decorative avatar and end-aligns numbers', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/components/record-workspace/');
  const orders = page.locator('[data-connected-schema=orders]').first();
  const table = orders
    .getByRole('region', { name: 'Record table with horizontal scrolling' })
    .first();
  await expect(table).toBeVisible();

  const customer = table.locator('tbody [data-leaf-field=customer]').first();
  await expect(customer.locator('dt')).toHaveText('Customer');
  const avatar = customer.locator('.atlas-avatar');
  await expect(avatar).toHaveCount(1);
  await expect(avatar).toBeVisible();
  // The adjacent name carries meaning; the avatar is decoration only.
  expect(await avatar.evaluate(el => el.closest('[aria-hidden=true]') !== null)).toBe(true);

  const recordId = await customer.locator('xpath=ancestor::tr[1]').getAttribute('data-record-id');
  const name = await customer.locator('dd').evaluate(dd => {
    const copy = dd.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.atlas-avatar').forEach(node => node.remove());
    return (copy.textContent ?? '').trim();
  });
  expect(name).not.toBe('');
  expect(name).not.toBe(recordId);
  await expect(customer.locator('dd')).toContainText(name);

  // Amount is an existing optional field; enable it through the real projection UI.
  const settings = orders.getByRole('button', { name: 'View settings', exact: true });
  await settings.click();
  await orders
    .getByRole('group', { name: 'Visible fields', exact: true })
    .getByRole('checkbox', { name: 'Amount', exact: true })
    .check();
  await settings.click();
  const numeric = table.locator(
    'tbody td[data-kind=money], tbody td[data-kind=unit], tbody td[data-kind=number]',
  );
  expect(await numeric.count()).toBeGreaterThan(0);
  const aligns = await numeric.evaluateAll(cells =>
    cells.map(cell => getComputedStyle(cell).textAlign),
  );
  expect([...new Set(aligns)]).toEqual(['end']);

  // Selection has no visible column text; it must fit its control and cell padding.
  const selection = await table
    .locator('tbody tr')
    .first()
    .locator('td')
    .first()
    .evaluate(cell => {
      const control = cell.querySelector('.ant-checkbox-wrapper')!;
      const box = control.getBoundingClientRect();
      const style = getComputedStyle(cell);
      return {
        width: cell.getBoundingClientRect().width,
        needed:
          Math.max(box.width, box.height) +
          Number.parseFloat(style.paddingLeft) +
          Number.parseFloat(style.paddingRight),
      };
    });
  expect(selection.width).toBeLessThanOrEqual(selection.needed + 2);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await table.scrollIntoViewIfNeeded();
  await testInfo.attach('record-workspace-orders-320', {
    body: await table.screenshot(),
    contentType: 'image/png',
  });
});
