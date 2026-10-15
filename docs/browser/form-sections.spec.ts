import { expect, test, type Page } from '@playwright/test';

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test('basic form groups related fields in two transparent fieldsets', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/components/form/');
  const form = page.locator('#profile-example');
  const profile = form.getByRole('group', { name: 'Profile details', exact: true });
  const workspace = form.getByRole('group', { name: 'Workspace preferences', exact: true });
  await expect(profile).toBeVisible();
  await expect(workspace).toBeVisible();
  await expect(profile).toHaveJSProperty('tagName', 'FIELDSET');
  await expect(workspace).toHaveJSProperty('tagName', 'FIELDSET');
  await expect(profile.getByLabel('Full name', { exact: true })).toBeVisible();
  await expect(profile.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(workspace.getByLabel('Team', { exact: true })).toBeAttached();
  await expect(
    workspace.getByRole('checkbox', { name: 'Follow product updates', exact: true }),
  ).toBeAttached();

  await expect(form.locator('fieldset')).toHaveCount(2);
  await expect(form.locator(':scope > fieldset')).toHaveCount(2);
  await expect(form.locator(':scope > fieldset > legend:first-child')).toHaveText([
    'Profile details',
    'Workspace preferences',
  ]);
  await expect(form.locator('.ant-card')).toHaveCount(0);
  await expect(form.locator('fieldset').getByRole('button')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Validate', exact: true })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();

  for (const fieldset of [profile, workspace]) {
    for (const side of ['top', 'right', 'bottom', 'left'])
      await expect(fieldset).toHaveCSS(`border-${side}-width`, '0px');
    await expect(fieldset).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(fieldset).toHaveCSS('box-shadow', 'none');
    const legendSize = await fieldset
      .locator(':scope > legend')
      .evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    expect(legendSize).toBeGreaterThanOrEqual(14);
  }
  await expectNoPageOverflow(page);
  await testInfo.attach('form-sections-320', {
    body: await form.screenshot({ path: testInfo.outputPath('form-sections-320.png') }),
    contentType: 'image/png',
  });
});

test('grouped basic form validates, finishes locally and resets', async ({ page }) => {
  await page.goto('/components/form/');
  const form = page.locator('#profile-example');
  const profile = form.getByRole('group', { name: 'Profile details', exact: true });
  const workspace = form.getByRole('group', { name: 'Workspace preferences', exact: true });
  const result = page.locator('.form-result');
  const fullName = profile.getByLabel('Full name', { exact: true });
  const email = profile.getByLabel('Email', { exact: true });
  const updates = workspace.getByRole('checkbox', {
    name: 'Follow product updates',
    exact: true,
  });

  await form.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(profile.getByText('Enter your full name.', { exact: true })).toBeVisible();
  await expect(profile.getByText('Enter your email address.', { exact: true })).toBeVisible();
  await expect(workspace.getByText('Choose a team.', { exact: true })).toBeVisible();
  await expect(result).toBeEmpty();

  await fullName.fill('Ada Lovelace');
  await email.fill('ada@example.com');
  await workspace.getByLabel('Team', { exact: true }).click();
  await page
    .locator('.ant-select-item-option:visible')
    .filter({ hasText: /^Design$/ })
    .click();
  await expect(workspace.getByText('Design', { exact: true })).toBeVisible();
  await updates.check();
  await form.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(result).toHaveText(
    'Fields validated for Ada Lovelace. This is a local example; no data was sent.',
  );
  await expect(form.getByText('Enter your full name.', { exact: true })).toHaveCount(0);

  await form.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(fullName).toHaveValue('');
  await expect(email).toHaveValue('');
  await expect(updates).not.toBeChecked();
  await expect(workspace.getByText('Design', { exact: true })).toBeHidden();
  await expect(result).toBeEmpty();
});

test('workspace steps keep named fieldset legends and the draft', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/components/record-forms/');
  const labels = ['Customer details', 'Payment and schedule', 'Notes and order lines'];
  const legends = page.locator(
    '[data-form-group] fieldset.record-form-panel-content > legend:first-child',
  );
  const customerGroup = page.getByRole('group', { name: labels[0], exact: true });
  const paymentGroup = page.getByRole('group', { name: labels[1], exact: true });
  const customer = page.locator('#record-form-customer');
  const email = page.locator('#record-form-email');

  await expect(legends).toHaveText(labels);
  await expect(customerGroup).toBeVisible();
  await expect(customerGroup).toHaveJSProperty('tagName', 'FIELDSET');
  await expect(customerGroup.locator('#record-form-customer')).toBeVisible();
  await expect(customerGroup.locator('#record-form-email')).toBeVisible();
  await customer.fill('Ada Lovelace');
  await email.fill('ada@example.com');
  await expectNoPageOverflow(page);

  await page.locator('#record-form-next').click();
  await expect(paymentGroup).toBeVisible();
  await expect(paymentGroup).toHaveJSProperty('tagName', 'FIELDSET');
  await expect(customerGroup).toHaveCount(0);
  await expect(legends).toHaveText(labels);

  await page.locator('#record-form-prev').click();
  await expect(customerGroup).toBeVisible();
  await expect(customer).toHaveValue('Ada Lovelace');
  await expect(email).toHaveValue('ada@example.com');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(customer).toHaveValue('Ada Lovelace');
  await expect(email).toHaveValue('ada@example.com');
  await expect(legends).toHaveText(labels);
  await expectNoPageOverflow(page);
});
