import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

test.use({ viewport: { width: 320, height: 720 } });

type Facts = Awaited<ReturnType<typeof readFacts>>;

function readFacts(button: Locator) {
  return button.evaluate(element => {
    const px = (value: string) => Number.parseFloat(value) || 0;
    const face = getComputedStyle(element, '::before');
    const box = element.getBoundingClientRect();
    const label = [...element.querySelectorAll('span')].find(
      span => span.children.length === 0 && span.textContent?.trim() === 'Continue',
    );
    const text = (label ?? element).getBoundingClientRect();
    const rect = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    return {
      depth: element.getAttribute('data-depth'),
      inset: {
        top: px(face.top),
        right: px(face.right),
        bottom: px(face.bottom),
        left: px(face.left),
      },
      faceContent: face.content,
      shadow: getComputedStyle(element).boxShadow,
      box: rect(box),
      text: rect(text),
      // Any painted descendant reaching below the button would read as a lip.
      overhang: Math.max(
        0,
        ...[...element.querySelectorAll('*')].map(
          child => child.getBoundingClientRect().bottom - box.bottom,
        ),
      ),
    };
  });
}

// Settle on the real CSS transitions (button and pseudo-elements) instead of sleeping.
async function settled(button: Locator) {
  await expect
    .poll(() =>
      button.evaluate(
        element =>
          element.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length,
      ),
    )
    .toBe(0);
  return readFacts(button);
}

async function openExample(page: Page, depth: '3d' | 'flat', heading: string) {
  await page.goto('/components/button/');
  const group = page.locator('#button-color-depth');
  const example = group.locator(`[data-button-depth-example="${depth}"]`);
  await expect(example.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  const button = example.getByRole('button', { name: 'Continue', exact: true });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('data-depth', depth);
  await button.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  return button;
}

async function pressAndRead(
  page: Page,
  button: Locator,
  testInfo: TestInfo,
  pressedReady: (facts: Facts) => boolean,
) {
  const rest = await settled(button);
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await expect.poll(async () => pressedReady(await readFacts(button))).toBe(true);
    const pressed = await settled(button);
    await testInfo.attach('depth-facts.json', {
      body: JSON.stringify({ rest, pressed }, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('pressed.png', {
      body: await button.screenshot({ animations: 'allow' }),
      contentType: 'image/png',
    });
    return { rest, pressed };
  } finally {
    await page.mouse.up();
  }
}

function expectStableGeometry(rest: Facts, pressed: Facts) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(pressed.box[key], `button ${key}`).toBeCloseTo(rest.box[key], 0);
    expect(pressed.text[key], `text ${key}`).toBeCloseTo(rest.text[key], 0);
  }
}

test('3D button keeps a lower lip at rest and presses into a top lip', async ({
  page,
}, testInfo) => {
  const button = await openExample(page, '3d', '3D');
  const { rest, pressed } = await pressAndRead(page, button, testInfo, f => f.inset.top > 0);

  expect(rest.depth).toBe('3d');
  expect(rest.inset.top).toBe(0);
  expect(rest.inset.bottom).toBeGreaterThan(0);
  expect(pressed.inset.top).toBeGreaterThan(0);
  expect(pressed.inset.bottom).toBeLessThan(rest.inset.bottom);
  expectStableGeometry(rest, pressed);
});

test('Flat button has no lip or depth at rest or while pressed', async ({ page }, testInfo) => {
  const button = await openExample(page, 'flat', 'Flat');
  const { rest, pressed } = await pressAndRead(page, button, testInfo, () => true);

  for (const facts of [rest, pressed]) {
    expect(facts.depth).toBe('flat');
    expect(facts.inset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(facts.shadow).toBe('none');
    expect(facts.overhang).toBeLessThanOrEqual(0.5);
  }
  expectStableGeometry(rest, pressed);
});
