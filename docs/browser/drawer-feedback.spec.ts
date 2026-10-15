import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect as baseExpect, test, type Page, type TestInfo } from '@playwright/test';

// Root config supplies baseURL (port 4324) and the Chromium 320px project.
const expect = baseExpect.configure({ timeout: 1_500 });
test.describe.configure({ timeout: 12_000 });

async function rootOverflow(page: Page) {
  return page.evaluate(() => ({
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
}

// Stable contract for /components/drawer/ ([data-demo="drawer"]):
// - trigger buttons named 'Open workspace navigation' and 'Open order details'
// - left dialog named 'Workspace navigation' with a combobox named 'Active workspace'
//   and local section buttons 'Overview', 'Orders', 'Team' marking the current one
//   with aria-current="page"
// - right dialog named 'Order details' showing 'ORD-1042' (header and summary), a list
//   named 'Activity', a textbox named 'Internal note' and a button named 'Add note'
//   (local only)
test('drawer opens named workspace and order panels, keeps the note draft and adds local activity', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/components/drawer/');

  const demo = page.locator('[data-demo="drawer"]');
  const leftTrigger = demo.getByRole('button', { name: 'Open workspace navigation', exact: true });
  const rightTrigger = demo.getByRole('button', { name: 'Open order details', exact: true });
  await expect(leftTrigger).toBeVisible();
  await expect(rightTrigger).toBeVisible();

  await leftTrigger.click();
  const navigation = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('combobox', { name: 'Active workspace' })).toBeVisible();
  for (const name of ['Overview', 'Orders', 'Team']) {
    await expect(navigation.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const overview = navigation.getByRole('button', { name: 'Overview', exact: true });
  const orders = navigation.getByRole('button', { name: 'Orders', exact: true });
  await expect(overview).toHaveAttribute('aria-current', 'page');
  await orders.click();
  await expect(orders).toHaveAttribute('aria-current', 'page');
  await expect(overview).not.toHaveAttribute('aria-current', /.*/);
  await expect(navigation.getByText('Current section: Orders', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(leftTrigger).toBeFocused();

  await rightTrigger.click();
  const order = page.getByRole('dialog', { name: 'Order details' });
  await expect(order).toBeVisible();
  await expect(order.getByText('ORD-1042', { exact: true }).first()).toBeVisible();
  const activity = order.getByRole('list', { name: 'Activity' });
  await expect(activity).toBeVisible();
  const note = order.getByRole('textbox', { name: 'Internal note' });
  const draft = 'Call courier before 5 pm';
  await note.fill(draft);

  await page.keyboard.press('Escape');
  await expect(order).toBeHidden();
  await expect(rightTrigger).toBeFocused();
  await rightTrigger.click();
  await expect(order).toBeVisible();
  await expect(note).toHaveValue(draft);

  const entries = activity.getByRole('listitem');
  const before = await entries.count();
  await order.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(entries).toHaveCount(before + 1);
  await expect(activity).toContainText(draft);

  const overflow = await rootOverflow(page);
  expect(overflow.root).toBeLessThanOrEqual(0);
  expect(overflow.body).toBeLessThanOrEqual(0);
});

// Stable contract for /components/toast/:
// - trigger buttons named exactly as in TOASTS below
// - each rendered toast root carries data-toast-placement ('top' | 'topRight') and
//   data-toast-entry ('top' | 'right'), and shows a message saying it was produced locally
// - toasts render inside the themed context (Outfit, >= 14px, --primary available)
const TOASTS = [
  { trigger: 'Toast · top center', placement: 'top', entry: 'top' },
  { trigger: 'Toast · top right from top', placement: 'topRight', entry: 'top' },
  { trigger: 'Toast · top right from right', placement: 'topRight', entry: 'right' },
] as const;

// Toast entry motion is the real native CSS animation, eased by the central Cubic
// curve from docs/src/data/motion.json ('top' enters from above, 'right' from the side).
const CENTRAL_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';

interface MotionFrame {
  x: number;
  y: number;
  opacity: number;
}

interface ToastMotionSample {
  found: boolean;
  reason?: string;
  name?: string;
  duration?: number;
  easing?: string;
  keyframes?: string[];
  start?: MotionFrame;
  end?: MotionFrame;
}

// Armed before the click: a MutationObserver sees the born toast, animationstart and
// rAF polling catch the CSS animation the native queue starts on it (or an ancestor).
// It is paused at once, sampled at its start and at 99% of its duration, then finished
// so the native lifecycle completes; no classes are forced and no sleeps are used.
async function armToastMotion(page: Page, selector: string) {
  await page.evaluate(sel => {
    const existing = new Set(document.querySelectorAll(sel));
    const w = window as unknown as { __toastMotion?: Promise<ToastMotionSample> };
    w.__toastMotion = new Promise<ToastMotionSample>(resolve => {
      let done = false;
      const settle = (sample: ToastMotionSample) => {
        if (done) return;
        done = true;
        observer.disconnect();
        document.removeEventListener('animationstart', check, true);
        clearTimeout(timer);
        resolve(sample);
      };
      const check = () => {
        if (done) return;
        const born = [...document.querySelectorAll(sel)].find(el => !existing.has(el));
        if (!born) return;
        const animation = document
          .getAnimations()
          .find(
            (a): a is CSSAnimation =>
              a instanceof CSSAnimation &&
              a.effect instanceof KeyframeEffect &&
              !!a.effect.target?.contains(born),
          );
        if (!animation) return;
        animation.pause();
        const effect = animation.effect as KeyframeEffect;
        const target = effect.target as Element;
        const timing = effect.getComputedTiming();
        const duration = Number(timing.duration);
        const delay = Number(timing.delay ?? 0);
        const read = (): MotionFrame => {
          const style = getComputedStyle(target);
          const matrix = new DOMMatrixReadOnly(
            style.transform === 'none' ? undefined : style.transform,
          );
          return { x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity) };
        };
        animation.currentTime = delay;
        const start = read();
        animation.currentTime = delay + duration * 0.99;
        const end = read();
        const sample: ToastMotionSample = {
          found: true,
          name: animation.animationName,
          duration,
          easing: getComputedStyle(target).animationTimingFunction,
          keyframes: effect.getKeyframes().map(frame => JSON.stringify(frame)),
          start,
          end,
        };
        animation.finish();
        settle(sample);
      };
      const timer = setTimeout(
        () => settle({ found: false, reason: 'no CSS animation started on the born toast' }),
        3_000,
      );
      const observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: true });
      document.addEventListener('animationstart', check, true);
      const tick = () => {
        if (done) return;
        check();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, selector);
}

test('toast triggers render themed local toasts with the requested placement and entry direction', async ({
  page,
}) => {
  await page.goto('/components/toast/');

  for (const { trigger, placement, entry } of TOASTS) {
    const button = page.getByRole('button', { name: trigger, exact: true });
    await expect(button).toBeVisible();
    const selector = `[data-toast-placement="${placement}"][data-toast-entry="${entry}"]`;
    await armToastMotion(page, selector);
    await button.click();

    const motion = await page.evaluate(
      () => (window as unknown as { __toastMotion: Promise<ToastMotionSample> }).__toastMotion,
    );
    expect(
      motion.found,
      `${trigger} starts a real CSS animation: ${motion.reason ?? 'found'}`,
    ).toBe(true);
    const { start, end } = motion as Required<ToastMotionSample>;
    const detail = `${trigger} ${JSON.stringify(motion)}`;
    expect(motion.duration, `${detail}: positive duration`).toBeGreaterThan(0);
    expect(motion.easing, `${detail}: central Cubic easing`).toBe(CENTRAL_EASING);
    expect(start.opacity, `${detail}: starts transparent`).toBeLessThan(0.05);
    expect(end.opacity, `${detail}: ends opaque`).toBeGreaterThan(0.95);
    if (entry === 'top') {
      expect(start.y, `${detail}: enters from above`).toBeLessThan(-1);
      expect(Math.abs(start.x), `${detail}: no sideways entry`).toBeLessThan(0.5);
    } else {
      expect(start.x, `${detail}: enters from the right`).toBeGreaterThan(1);
      expect(Math.abs(start.y), `${detail}: no vertical entry`).toBeLessThan(0.5);
    }
    expect(Math.abs(end.x), `${detail}: settles horizontally`).toBeLessThan(0.5);
    expect(Math.abs(end.y), `${detail}: settles vertically`).toBeLessThan(0.5);

    const toast = page
      .locator(`[data-toast-placement="${placement}"][data-toast-entry="${entry}"]`)
      .last();
    await expect(toast, `${trigger} renders a toast`).toBeVisible();
    await expect(toast).toContainText(/local/i);

    const style = await toast.evaluate(el => {
      const computed = getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        fontSize: parseFloat(computed.fontSize),
        primary: computed.getPropertyValue('--primary').trim(),
      };
    });
    expect(style.fontFamily, `${trigger} uses the theme font`).toMatch(/Outfit/i);
    expect(style.fontSize, `${trigger} text is at least 14px`).toBeGreaterThanOrEqual(14);
    expect(style.primary, `${trigger} inherits theme tokens`).not.toBe('');
  }
});

// Stable contract:
// - /components/popconfirm/ [data-demo="popconfirm"]: trigger 'Archive sample', popconfirm
//   buttons 'Cancel' and 'Archive', role=status announces 'Archived locally' only after confirm
// - /components/alert/ [data-demo="alert"]: persistent inline alert (role=alert, no close button)
// - /components/notification/: trigger 'Show notification' opens a non-urgent notice
//   (.ant-notification-notice with role=status) with text and at least one action button
test('popconfirm archives only after confirm, inline alert persists and notification is rich', async ({
  page,
}) => {
  await page.goto('/components/popconfirm/');
  const popDemo = page.locator('[data-demo="popconfirm"]');
  const archiveTrigger = popDemo.getByRole('button', { name: 'Archive sample', exact: true });
  const status = popDemo.getByRole('status');

  await archiveTrigger.click();
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(cancel).toBeHidden();
  await expect(status).not.toHaveText('Archived locally');

  await archiveTrigger.click();
  const confirm = page.getByRole('button', { name: 'Archive', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(status).toHaveText('Archived locally');

  await page.goto('/components/alert/');
  const inlineAlert = page.locator('[data-demo="alert"]').getByRole('alert').first();
  await expect(inlineAlert).toBeVisible();
  await expect(inlineAlert).toHaveText(/\S/);
  await expect(inlineAlert.getByRole('button', { name: /close/i })).toHaveCount(0);

  await page.goto('/components/notification/');
  await page.getByRole('button', { name: 'Show notification', exact: true }).click();
  const notice = page.locator('.ant-notification-notice[role="status"]').last();
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(/\S/);
  expect(await notice.getByRole('button').count()).toBeGreaterThanOrEqual(1);
});

// Stable contract for /components/modal/ ([data-demo="modal"]):
// - trigger 'Review changes' opens the dialog 'Review local changes' listing two changes
// - 'Cancel' and Escape close it, return focus to the trigger and keep
//   '2 changes waiting for review.'
// - 'Apply changes' closes it and the page shows exactly 'Changes applied locally.'
test('modal review cancels or escapes without changes and applies only locally', async ({
  page,
}) => {
  await page.goto('/components/modal/');
  const demo = page.locator('[data-demo="modal"]');
  const trigger = demo.getByRole('button', { name: 'Review changes', exact: true });
  const result = demo.locator('p', { hasText: /changes (waiting for review|applied locally)/i });
  const dialog = page.getByRole('dialog', { name: 'Review local changes' });
  await expect(trigger).toBeVisible();
  await expect(result).toHaveText('2 changes waiting for review.');

  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Title changed to Quarterly plan.');
  await expect(dialog).toContainText('Two tags were added.');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(result).toHaveText('2 changes waiting for review.');

  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(result).toHaveText('2 changes waiting for review.');

  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(result).toBeVisible();
  await expect(result).toHaveText('Changes applied locally.');
});

// Overlay backdrop regression - fragment A: shared types, row table, openers. B measures, C owns the single test() and close behaviour.
type OverlayBackdropLocator = ReturnType<Page['locator']>;

type OverlayBackdropRow = {
  key: string;
  route: string;
  kind: 'nonmodal' | 'modal' | 'negative' | 'native';
  role?: 'button' | 'combobox' | 'textbox';
  name?: string;
  selector?: string;
  query?: string;
  popup: string;
  legacy?: boolean;
  nested?: boolean;
  tooltip?: boolean;
  // Real control that closes the layer instead of Escape.
  close?: string;
  // Widths where the layer exists; other widths record an explicit not_applicable.
  widths?: number[];
};

const overlayBackdropDialogPopup = '.ant-drawer-open [role=dialog]';
const overlayBackdropMenuPopup = '.ant-dropdown:not(.ant-dropdown-hidden)';
const overlayBackdropSelectPopup = '.ant-select-dropdown:not(.ant-select-dropdown-hidden)';
const overlayBackdropPickerPopup = '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)';
const overlayBackdropDateRoute = '/components/date-time/';
const overlayBackdropDrawerRoute = '/components/drawer/';
const overlayBackdropDrawerHostName = 'Open workspace navigation';

const overlayBackdropRows: OverlayBackdropRow[] = [
  {
    key: 'dropdown',
    route: '/components/dropdown/',
    kind: 'nonmodal',
    role: 'button',
    name: 'Workspace actions',
    popup: overlayBackdropMenuPopup,
  },
  {
    key: 'select-single',
    route: '/components/select/',
    kind: 'nonmodal',
    selector: '#select-single',
    popup: overlayBackdropSelectPopup,
  },
  {
    key: 'autocomplete',
    route: '/components/autocomplete/',
    kind: 'nonmodal',
    role: 'combobox',
    name: 'Find in the documentation',
    query: 'button',
    popup: overlayBackdropSelectPopup,
  },
  {
    key: 'cascader',
    route: '/components/cascader/',
    kind: 'nonmodal',
    role: 'combobox',
    name: 'Workspace destination',
    popup: '.ant-cascader-dropdown:not(.ant-select-dropdown-hidden)',
  },
  {
    key: 'rich-menu',
    route: '/components/rich-menu/',
    kind: 'nonmodal',
    role: 'button',
    name: 'Workspace shortcuts',
    popup: overlayBackdropMenuPopup,
  },
  {
    key: 'date-picker',
    route: overlayBackdropDateRoute,
    kind: 'nonmodal',
    role: 'textbox',
    name: 'Delivery date',
    popup: overlayBackdropPickerPopup,
  },
  {
    key: 'time-picker',
    route: overlayBackdropDateRoute,
    kind: 'nonmodal',
    role: 'textbox',
    name: 'Daily reminder',
    popup: overlayBackdropPickerPopup,
  },
  {
    key: 'date-range-picker',
    route: overlayBackdropDateRoute,
    kind: 'nonmodal',
    role: 'textbox',
    name: 'Stay dates',
    popup: overlayBackdropPickerPopup,
  },
  {
    key: 'time-range-picker',
    route: overlayBackdropDateRoute,
    kind: 'nonmodal',
    role: 'textbox',
    name: 'Working hours',
    popup: overlayBackdropPickerPopup,
  },
  {
    key: 'popconfirm',
    route: '/components/popconfirm/',
    kind: 'nonmodal',
    role: 'button',
    name: 'Archive sample',
    popup: '.ant-popover:not(.ant-popover-hidden)',
  },
  {
    key: 'drawer-navigation',
    route: overlayBackdropDrawerRoute,
    kind: 'modal',
    role: 'button',
    name: overlayBackdropDrawerHostName,
    popup: overlayBackdropDialogPopup,
  },
  {
    key: 'drawer-details',
    route: overlayBackdropDrawerRoute,
    kind: 'modal',
    role: 'button',
    name: 'Open order details',
    popup: overlayBackdropDialogPopup,
  },
  {
    key: 'modal',
    route: '/components/modal/',
    kind: 'modal',
    role: 'button',
    name: 'Review changes',
    popup: '.ant-modal[role=dialog]',
  },
  {
    key: 'theme-builder-preset',
    route: '/theme-builder/',
    kind: 'nonmodal',
    selector: '#tb-preset',
    popup: overlayBackdropSelectPopup,
    legacy: true,
  },
  {
    key: 'breadcrumb',
    route: '/components/breadcrumb/',
    kind: 'nonmodal',
    role: 'button',
    name: 'Navigate Data workspace pages',
    popup: overlayBackdropMenuPopup,
  },
  {
    key: 'input-tweaker',
    route: '/components/input/',
    kind: 'modal',
    role: 'button',
    name: 'Open tweaker',
    popup: overlayBackdropDialogPopup,
  },
  {
    key: 'drawer-nested-select',
    route: overlayBackdropDrawerRoute,
    kind: 'nonmodal',
    role: 'combobox',
    name: 'Active workspace',
    popup: overlayBackdropSelectPopup,
    nested: true,
  },
  {
    key: 'tooltip',
    route: '/components/slider/',
    kind: 'nonmodal',
    selector: '[data-slider-example=linear] .ant-slider-handle[role=slider]',
    popup: '.ant-tooltip:not(.ant-tooltip-hidden)',
    tooltip: true,
  },
  {
    key: 'toast',
    route: '/components/toast/',
    kind: 'negative',
    role: 'button',
    name: 'Toast · top center',
    popup: '.atlas-toast',
  },
  {
    key: 'notification',
    route: '/components/notification/',
    kind: 'negative',
    role: 'button',
    name: 'Show notification',
    popup: '.atlas-notification',
  },
  {
    // Docs shell menu Drawer: native modal <dialog>, only below the 875px sidebar breakpoint.
    key: 'docs-menu-drawer',
    route: overlayBackdropDrawerRoute,
    kind: 'native',
    selector: '[data-docs-shell] [data-docs-menu-toggle]',
    popup: 'dialog[data-docs-drawer][open]',
    close: 'dialog[data-docs-drawer][open] [data-docs-menu-close]',
    widths: [320],
  },
];

function overlayBackdropTrigger(
  scope: Page | OverlayBackdropLocator,
  row: OverlayBackdropRow,
): OverlayBackdropLocator {
  if (row.selector) return scope.locator(row.selector).first();
  if (!row.name)
    throw new Error(
      'overlayBackdrop row ' + row.key + ' needs a selector or an exact accessible name',
    );
  return scope.getByRole(row.role ?? 'button', { name: row.name, exact: true }).first();
}

async function overlayBackdropSettle(page: Page, trigger: OverlayBackdropLocator): Promise<void> {
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  const island = trigger.locator('xpath=ancestor::astro-island[1]');
  if ((await island.count()) > 0) await expect(island).not.toHaveAttribute('ssr');
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(
    () =>
      new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

async function overlayBackdropOpen(
  page: Page,
  row: OverlayBackdropRow,
  via: 'click' | 'hover' | 'focus' = row.tooltip ? 'hover' : 'click',
): Promise<{ trigger: OverlayBackdropLocator; popup: OverlayBackdropLocator }> {
  let scope: Page | OverlayBackdropLocator = page;
  if (row.nested) {
    const host = page
      .getByRole('button', { name: overlayBackdropDrawerHostName, exact: true })
      .first();
    await overlayBackdropSettle(page, host);
    await host.click();
    const dialog = page.locator(overlayBackdropDialogPopup).filter({ visible: true }).first();
    await expect(dialog).toBeVisible();
    scope = dialog;
  }
  const trigger = overlayBackdropTrigger(scope, row);
  await overlayBackdropSettle(page, trigger);
  if (via === 'hover') await trigger.hover();
  else if (via === 'focus') {
    // Real keyboard focus: step off the trigger with Shift+Tab, then Tab back onto it.
    await trigger.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(trigger).toBeFocused();
  } else await trigger.click();
  if (row.query !== undefined) await trigger.fill(row.query);
  const popup = page.locator(row.popup).filter({ visible: true }).first();
  await expect(popup).toBeVisible();
  return { trigger, popup };
}

// Part B: real computed-style / paint measurement for the overlay backdrop contract (no test() here).
async function overlayBackdropSettlePopup(
  page: Page,
  popup: OverlayBackdropLocator,
  trigger: OverlayBackdropLocator,
): Promise<void> {
  const popupHandle = await popup.elementHandle();
  const triggerHandle = await trigger.elementHandle();
  if (!popupHandle || !triggerHandle) {
    throw new Error(
      `overlayBackdrop: cannot settle, missing ${popupHandle ? 'trigger' : 'popup'} element`,
    );
  }
  try {
    await page.waitForFunction(
      ({ popupEl, triggerEl, seq }) => {
        const motion = /(^|\s)\S+-(appear|enter|leave)(-(prepare|start|active))?(?=\s|$)/;
        const cls = (el: Element) => el.getAttribute('class') ?? '';
        const scope = popupEl.closest('.ant-modal-root, .ant-drawer') ?? popupEl;
        const hostRoot = triggerEl.closest('.ant-drawer, .ant-modal-root');
        const roots = [scope, triggerEl, hostRoot].filter((n): n is Element => !!n);
        const inMotion = roots.some(r =>
          [r, ...Array.from(r.querySelectorAll('*'))].some(e => motion.test(cls(e))),
        );
        const active = (a: Animation) => {
          const t = a.effect?.getComputedTiming();
          return !!t && t.iterations !== Infinity && (a.playState === 'running' || a.pending);
        };
        const bodyOwn = (a: Animation) =>
          (a.effect as KeyframeEffect | null)?.target === document.body;
        const running =
          roots
            .reduce<Animation[]>((all, r) => all.concat(r.getAnimations({ subtree: true })), [])
            .filter(active).length +
          document.body.getAnimations({ subtree: true }).filter(a => bodyOwn(a) && active(a))
            .length;
        const pr = popupEl.getBoundingClientRect();
        const pcs = getComputedStyle(popupEl);
        const ps = getComputedStyle(document.body, '::before');
        const visible =
          pr.width > 0 &&
          pr.height > 0 &&
          pcs.visibility !== 'hidden' &&
          !/(^|\s)ant-\S+-hidden(?=\s|$)/.test(cls(popupEl));
        const snap = JSON.stringify([
          seq,
          pr.toJSON(),
          triggerEl.getBoundingClientRect().toJSON(),
          pcs.opacity,
          pcs.transform,
          ps.backgroundColor,
          ps.clipPath,
          ps.opacity,
        ]);
        const w = window as Window & { __overlayBackdropSettle?: string };
        const stable = w.__overlayBackdropSettle === snap;
        w.__overlayBackdropSettle = snap;
        return visible && !inMotion && running === 0 && stable;
      },
      { popupEl: popupHandle, triggerEl: triggerHandle, seq: `${Date.now()}-${Math.random()}` },
      { polling: 'raf' },
    );
  } finally {
    await popupHandle.dispose();
    await triggerHandle.dispose();
  }
}

async function overlayBackdropMeasure(
  page: Page,
  popup: OverlayBackdropLocator,
  trigger: OverlayBackdropLocator,
  kind: OverlayBackdropRow['kind'],
): Promise<{ issues: string[]; facts: Record<string, unknown> }> {
  await overlayBackdropSettlePopup(page, popup, trigger);
  const popupHandle = await popup.elementHandle();
  const triggerHandle = await trigger.elementHandle();
  if (!popupHandle || !triggerHandle) {
    throw new Error(
      `overlayBackdrop: missing ${popupHandle ? 'trigger' : 'popup'} element (${kind})`,
    );
  }
  try {
    return await page.evaluate(
      ({ popupEl, triggerEl, rowKind }) => {
        const issues: string[] = [];
        const need = (ok: unknown, msg: string) => {
          if (!ok) issues.push(msg);
        };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cs = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);
        const num = (v: string) => Number.parseFloat(v) || 0;
        const px = (v: string) => {
          const m = v.match(/([\d.]+)px/);
          return m ? num(m[1]) : 0;
        };
        const blurPx = (filter: string) => {
          let max = 0;
          const re = /(?:^|[\s)])blur\(\s*([\d.]+)(?:px)?\s*\)/g;
          for (let m = re.exec(filter); m; m = re.exec(filter)) max = Math.max(max, num(m[1]));
          return max;
        };
        const backdrop = (s: CSSStyleDeclaration) =>
          s.getPropertyValue('backdrop-filter') ||
          s.getPropertyValue('-webkit-backdrop-filter') ||
          'none';
        const color = (v: string) => {
          const m = v.trim().match(/^(rgba?|color)\((?:srgb\s+)?([^)]+)\)$/);
          if (!m) return null;
          const p = m[2]
            .replace('/', ' ')
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(t => (t.endsWith('%') ? num(t) / 100 : Number(t)));
          const k = m[1] === 'color' ? 255 : 1;
          return { r: p[0] * k, g: p[1] * k, b: p[2] * k, a: p.length > 3 ? p[3] : 1 };
        };
        const sameColor = (a: ReturnType<typeof color>, b: ReturnType<typeof color>) =>
          !!a &&
          !!b &&
          Math.abs(a.r - b.r) < 1 &&
          Math.abs(a.g - b.g) < 1 &&
          Math.abs(a.b - b.b) < 1 &&
          Math.abs(a.a - b.a) < 0.01;
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            cx: r.x + r.width / 2,
            cy: r.y + r.height / 2,
          };
        };
        const inside = (r: ReturnType<typeof rect>, x: number, y: number) =>
          x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        const isCtx = (s: CSSStyleDeclaration) =>
          (s.position !== 'static' && s.zIndex !== 'auto') ||
          s.position === 'fixed' ||
          s.position === 'sticky' ||
          num(s.opacity) < 1 ||
          s.transform !== 'none' ||
          s.filter !== 'none' ||
          backdrop(s) !== 'none' ||
          s.isolation === 'isolate' ||
          s.mixBlendMode !== 'normal';
        const describe = (el: Element | null) =>
          el ? `${el.tagName.toLowerCase()}.${el.className}` : null;
        const topZ = (el: Element) => {
          let ctx: Element | null = null;
          for (
            let n: Element | null = el;
            n && n !== document.body && n !== document.documentElement;
            n = n.parentElement
          )
            if (isCtx(cs(n))) ctx = n;
          const z = ctx ? cs(ctx).zIndex : 'auto';
          return { ctx: describe(ctx), z: z === 'auto' ? 0 : num(z) };
        };
        const clipPath = (v: string): { path: Path2D; rule: CanvasFillRule } | null => {
          const m = v.match(/^(path|polygon)\((?:(evenodd|nonzero)\s*,\s*)?([\s\S]*)\)$/);
          if (!m) return null;
          const rule: CanvasFillRule = m[2] === 'evenodd' ? 'evenodd' : 'nonzero';
          if (m[1] === 'path')
            return { path: new Path2D(m[3].trim().replace(/^["']|["']$/g, '')), rule };
          const path = new Path2D();
          m[3].split(',').forEach((pair, i) => {
            const [x, y] = pair
              .trim()
              .split(/\s+/)
              .map((c, j) => (c.endsWith('%') ? (num(c) / 100) * (j ? vh : vw) : num(c)));
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          });
          path.closePath();
          return { path, rule };
        };
        const tok = (name: string) =>
          cs(document.body).getPropertyValue(name).trim() ||
          cs(document.documentElement).getPropertyValue(name).trim();
        const tokens = {
          scrim: tok('--overlay-scrim'),
          blur: tok('--overlay-backdrop-blur'),
          open: tok('--overlay-open-duration'),
          close: tok('--overlay-close-duration'),
          easing: tok('--overlay-easing'),
        };
        const checkScrim = (label: string, bg: string, filter: string) => {
          const c = color(bg);
          need(
            c && c.a > 0 && c.r === c.g && c.g === c.b,
            `${label}: scrim must be neutral rgba with alpha > 0, got "${bg}"`,
          );
          need(
            /blur\(/.test(filter) && px(filter) === 1,
            `${label}: backdrop blur must be exactly 1px, got "${filter}"`,
          );
          need(
            sameColor(c, color(tokens.scrim)),
            `${label}: scrim "${bg}" does not equal --overlay-scrim "${tokens.scrim}"`,
          );
          need(
            px(tokens.blur) === 1,
            `--overlay-backdrop-blur must resolve to 1px, got "${tokens.blur}"`,
          );
        };

        const paint = triggerEl.matches('input, textarea')
          ? (triggerEl.closest('.ant-select, .ant-picker, .atlas-input-frame, button') ?? triggerEl)
          : triggerEl;
        const pr = rect(popupEl);
        const tr = rect(paint);
        const hostPanel =
          rowKind === 'nonmodal' ? paint.closest('.ant-drawer-content, [role=dialog]') : null;
        const hostRoot = hostPanel?.closest('.ant-drawer, .ant-modal-root') ?? null;
        const host =
          hostPanel &&
          cs(hostPanel).display !== 'none' &&
          cs(hostPanel).visibility !== 'hidden' &&
          (!hostRoot ||
            !hostRoot.classList.contains('ant-drawer') ||
            hostRoot.classList.contains('ant-drawer-open'))
            ? hostPanel
            : null;
        const hr = host ? rect(host) : null;
        const hostMask = host
          ? (hostRoot?.querySelector(':scope > .ant-modal-mask, :scope > .ant-drawer-mask') ?? null)
          : null;
        const hms = hostMask ? cs(hostMask) : null;
        const hostMaskOn =
          !!hostMask &&
          !!hms &&
          hms.display !== 'none' &&
          hms.visibility !== 'hidden' &&
          num(hms.opacity) > 0 &&
          !hostMask.classList.contains('ant-modal-mask-hidden');
        const corners = (r: { x: number; y: number; w: number; h: number }) => [
          [r.x + r.w - 4, r.y + r.h - 4],
          [r.x + 4, r.y + r.h - 4],
          [r.x + r.w - 4, r.y + 4],
          [r.x + 4, r.y + 4],
        ];
        const free = ([x, y]: number[]) =>
          x >= 0 && x <= vw && y >= 0 && y <= vh && !inside(pr, x, y) && !inside(tr, x, y);
        const inHost = ([x, y]: number[]) => !hr || inside(hr, x, y);
        const bgPoint =
          corners(hr ?? { x: 0, y: 0, w: vw, h: vh }).find(p => free(p) && inHost(p)) ??
          (hr ? [hr.x + 4, hr.y + hr.h - 4] : [vw - 4, vh - 4]);
        const outsidePoint = hr
          ? (corners({ x: 0, y: 0, w: vw, h: vh }).find(p => free(p) && !inHost(p)) ?? null)
          : null;
        const hit = (x: number, y: number) => document.elementFromPoint(x, y);
        // Tooltip popups paint with pointer-events:none, which elementFromPoint skips. Probe their
        // paint once with pointer-events:auto and restore the inline value synchronously.
        const popupPointer = cs(popupEl).pointerEvents;
        const paintHit = (x: number, y: number) => {
          if (popupPointer !== 'none' || !(popupEl instanceof HTMLElement)) return hit(x, y);
          const inline = popupEl.style.getPropertyValue('pointer-events');
          const priority = popupEl.style.getPropertyPriority('pointer-events');
          popupEl.style.setProperty('pointer-events', 'auto', 'important');
          try {
            return hit(x, y);
          } finally {
            if (inline) popupEl.style.setProperty('pointer-events', inline, priority);
            else popupEl.style.removeProperty('pointer-events');
          }
        };
        const hits = {
          popupCenter: popupEl.contains(paintHit(pr.cx, pr.cy)),
          triggerCenter: paint.contains(hit(tr.cx, tr.cy)),
          background: describe(hit(bgPoint[0], bgPoint[1])),
        };
        const ps = cs(document.body, '::before');
        const pseudoOn =
          !/^(none|normal)$/.test(ps.content) &&
          ps.display !== 'none' &&
          num(ps.opacity) > 0 &&
          ps.visibility !== 'hidden';
        const pseudoCovers =
          ps.position === 'fixed' &&
          num(ps.top) === 0 &&
          num(ps.left) === 0 &&
          ((num(ps.right) === 0 && num(ps.bottom) === 0) ||
            (num(ps.width) >= vw && num(ps.height) >= vh));
        const pseudoZ = ps.zIndex === 'auto' ? 0 : num(ps.zIndex);
        const root = popupEl.closest('.ant-modal-root, .ant-drawer');
        const mask =
          root?.querySelector(':scope > .ant-modal-mask, :scope > .ant-drawer-mask') ?? null;
        const ms = mask ? cs(mask) : null;
        const maskOn =
          !!mask &&
          !!ms &&
          ms.display !== 'none' &&
          ms.visibility !== 'hidden' &&
          num(ms.opacity) > 0 &&
          !mask.classList.contains('ant-modal-mask-hidden') &&
          (!root ||
            !root.classList.contains('ant-drawer') ||
            root.classList.contains('ant-drawer-open'));
        const dialogWrap = root
          ? (Array.from(root.children).find(c => c.contains(popupEl)) ?? null)
          : null;
        const smallText = [popupEl, ...Array.from(popupEl.querySelectorAll('*'))]
          .filter(
            e =>
              cs(e).display !== 'none' &&
              Array.from(e.childNodes).some(
                n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim(),
              ),
          )
          .map(e => ({ el: describe(e), px: num(cs(e).fontSize) }))
          .filter(f => f.px < 14)
          .slice(0, 5);

        need(smallText.length === 0, `popup text below 14px: ${JSON.stringify(smallText)}`);
        need(
          blurPx(cs(popupEl).filter) === 0,
          `popup own filter must not blur (drop-shadow is allowed), got "${cs(popupEl).filter}"`,
        );
        let nativeBackdrop: Record<string, unknown> | null = null;
        if (rowKind === 'nonmodal') {
          need(pseudoOn, 'body::before scrim is not rendered while the non-modal popup is open');
          need(pseudoCovers, `body::before must be fixed inset:0 covering ${vw}x${vh}`);
          checkScrim('body::before', ps.backgroundColor, backdrop(ps));
          need(
            blurPx(cs(paint).filter) === 0,
            `trigger own filter must not blur (drop-shadow is allowed), got "${cs(paint).filter}"`,
          );
          need(
            hits.popupCenter,
            'popup center is not the topmost painted element (covered by the scrim?)',
          );
          if (host) {
            need(hostMask && hostMaskOn, 'nested popup host dialog has no visible native mask');
            if (hostMask && hms) checkScrim('host dialog mask', hms.backgroundColor, backdrop(hms));
          }
          const clip = clipPath(ps.clipPath);
          const ctx2d = document.createElement('canvas').getContext('2d');
          if (clip && ctx2d) {
            const covered = (x: number, y: number) =>
              ctx2d.isPointInPath(clip.path, x, y, clip.rule);
            need(!covered(pr.cx, pr.cy), 'body::before clip-path still covers the popup center');
            need(!covered(tr.cx, tr.cy), 'body::before clip-path still covers the trigger center');
            need(
              covered(bgPoint[0], bgPoint[1]),
              `body::before clip-path does not cover background point ${bgPoint.join(',')}${hr ? ' inside the host dialog panel' : ''}`,
            );
            if (outsidePoint)
              need(
                !covered(outsidePoint[0], outsidePoint[1]),
                `body::before clip-path must not cover viewport point ${outsidePoint.join(',')} outside the host dialog panel (its native mask already dims it)`,
              );
          } else {
            need(
              topZ(popupEl).z >= pseudoZ,
              `popup stacking root z ${topZ(popupEl).z} is below body::before z ${pseudoZ}`,
            );
            need(
              topZ(paint).z >= pseudoZ,
              `trigger stacking root z ${topZ(paint).z} is below body::before z ${pseudoZ}`,
            );
          }
        } else if (rowKind === 'modal') {
          need(mask && ms, 'no .ant-modal-mask / .ant-drawer-mask paired with the popup root');
          need(maskOn, 'modal mask is not visible');
          if (mask && ms && root) {
            const mr = rect(mask);
            need(
              mr.x <= 0 && mr.y <= 0 && mr.w >= vw && mr.h >= vh,
              `mask rect ${JSON.stringify(mr)} does not cover ${vw}x${vh}`,
            );
            checkScrim('modal mask', ms.backgroundColor, backdrop(ms));
            need(
              dialogWrap &&
                num(cs(dialogWrap).zIndex) >= num(ms.zIndex) &&
                !!(mask.compareDocumentPosition(dialogWrap) & Node.DOCUMENT_POSITION_FOLLOWING),
              'dialog is not stacked above its mask',
            );
            need(
              !dialogWrap || cs(dialogWrap).filter === 'none',
              'dialog wrapper must not be blurred',
            );
            need(hits.popupCenter, 'dialog center is not the topmost painted element');
            need(
              !hits.triggerCenter && root.contains(hit(tr.cx, tr.cy)),
              'trigger is not behind the modal mask',
            );
            need(
              topZ(paint).z < topZ(mask).z,
              `trigger stacking root z ${topZ(paint).z} is not below mask root z ${topZ(mask).z}`,
            );
          }
        } else if (rowKind === 'native') {
          // Native modal <dialog>: its own ::backdrop is the single scrim over the whole page,
          // trigger included; the panel stays clear and body::before stays off.
          const bs = cs(popupEl, '::backdrop');
          const durations = (v: string) =>
            v
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
              .map(t => (t.endsWith('ms') ? num(t) : num(t) * 1000));
          const curve = (v: string) =>
            `${v.trim().match(/^[a-z-]+/i)?.[0] ?? ''}(${(v.match(/-?[0-9]*[.]?[0-9]+/g) ?? []).map(Number).join(',')})`;
          const easings = bs.transitionTimingFunction.match(/[a-z-]+(?:[(][^)]*[)])?/gi) ?? [];
          const open = durations(bs.transitionDuration);
          const openToken = durations(tokens.open);
          const inset = ['top', 'right', 'bottom', 'left'].every(
            side => bs.getPropertyValue(side) === '0px',
          );
          const triggerHit = hit(tr.cx, tr.cy);
          const bgHit = hit(bgPoint[0], bgPoint[1]);
          need(popupEl.matches(':modal'), 'native drawer is not an open modal dialog');
          need(
            bs.display !== 'none' && bs.position === 'fixed' && inset,
            `dialog::backdrop must be fixed inset:0 covering ${vw}x${vh}`,
          );
          need(
            num(bs.opacity) > 0.99,
            `dialog::backdrop is not fully shown, opacity ${bs.opacity}`,
          );
          checkScrim('dialog::backdrop', bs.backgroundColor, backdrop(bs));
          need(hits.popupCenter, 'drawer panel centre is not the topmost painted element');
          need(
            !hits.triggerCenter && !!triggerHit && popupEl.contains(triggerHit),
            'trigger is not behind the native backdrop or the drawer panel',
          );
          need(
            bgHit === popupEl && !inside(pr, bgPoint[0], bgPoint[1]),
            `background point ${bgPoint.join(',')} is not covered by dialog::backdrop`,
          );
          need(
            popupEl.contains(document.activeElement),
            'focus did not move into the native drawer',
          );
          need(
            openToken.length === 1 &&
              openToken[0] > 0 &&
              open.length > 0 &&
              open.every(d => Math.abs(d - openToken[0]) < 0.5),
            `dialog::backdrop transition-duration ${bs.transitionDuration} must use --overlay-open-duration ${tokens.open}`,
          );
          need(
            easings.length > 0 && easings.every(e => curve(e) === curve(tokens.easing)),
            `dialog::backdrop easing ${bs.transitionTimingFunction} must use --overlay-easing ${tokens.easing}`,
          );
          need(
            !pseudoOn || (color(ps.backgroundColor)?.a === 0 && px(backdrop(ps)) === 0),
            'body::before must stay off; the native backdrop is the only background scrim',
          );
          const stray = document.querySelector(
            '.ant-drawer-open > .ant-drawer-mask, .ant-modal-root > .ant-modal-mask:not(.ant-modal-mask-hidden)',
          );
          need(
            !stray || cs(stray).display === 'none' || num(cs(stray).opacity) === 0,
            'a second Ant mask is visible behind the native drawer',
          );
          nativeBackdrop = {
            modal: popupEl.matches(':modal'),
            display: bs.display,
            position: bs.position,
            inset,
            opacity: bs.opacity,
            background: bs.backgroundColor,
            backdrop: backdrop(bs),
            transitionDuration: bs.transitionDuration,
            transitionTimingFunction: bs.transitionTimingFunction,
            triggerHit: describe(triggerHit),
            backgroundHit: describe(bgHit),
            focus: describe(document.activeElement),
          };
        } else {
          need(
            !pseudoOn || (color(ps.backgroundColor)?.a === 0 && px(backdrop(ps)) === 0),
            `body::before must stay transparent with blur 0 for ${rowKind}`,
          );
          const stray = document.querySelector(
            '.ant-drawer-open > .ant-drawer-mask, .ant-modal-root > .ant-modal-mask:not(.ant-modal-mask-hidden)',
          );
          need(
            !stray || cs(stray).display === 'none' || num(cs(stray).opacity) === 0,
            'an active modal mask is visible during a negative case',
          );
          need(!maskOn, 'negative popup must not carry a modal mask');
        }
        const facts: Record<string, unknown> = {
          kind: rowKind,
          viewport: { vw, vh },
          tokens,
          rects: { popup: pr, trigger: tr, mask: mask ? rect(mask) : null, host: hr },
          bgPoint,
          outsidePoint,
          outsideClip: !hr ? null : outsidePoint ? 'checked' : 'not_applicable',
          hits,
          smallText,
          host: host
            ? {
                el: describe(host),
                mask:
                  hostMask && hms
                    ? {
                        on: hostMaskOn,
                        background: hms.backgroundColor,
                        backdrop: backdrop(hms),
                        z: hms.zIndex,
                      }
                    : null,
              }
            : null,
          popup: {
            el: describe(popupEl),
            filter: cs(popupEl).filter,
            blur: blurPx(cs(popupEl).filter),
            topZ: topZ(popupEl),
          },
          trigger: {
            el: describe(paint),
            filter: cs(paint).filter,
            blur: blurPx(cs(paint).filter),
            topZ: topZ(paint),
          },
          bodyBefore: {
            on: pseudoOn,
            covers: pseudoCovers,
            content: ps.content,
            background: ps.backgroundColor,
            backdrop: backdrop(ps),
            clipPath: ps.clipPath,
            z: pseudoZ,
            pointerEvents: ps.pointerEvents,
          },
          nativeBackdrop,
          mask:
            mask && ms
              ? {
                  on: maskOn,
                  background: ms.backgroundColor,
                  backdrop: backdrop(ms),
                  z: ms.zIndex,
                  topZ: topZ(mask),
                  dialogZ: dialogWrap ? cs(dialogWrap).zIndex : null,
                }
              : null,
        };
        return { issues, facts };
      },
      { popupEl: popupHandle, triggerEl: triggerHandle, rowKind: kind },
    );
  } finally {
    await popupHandle.dispose();
    await triggerHandle.dispose();
  }
}

// Part D: frame-by-frame close sampling of the body::before scrim plus the SSR import probe (no test() here).
type OverlayBackdropCloseFrame = {
  t: number;
  level: number;
  opacity: number;
  alpha: number;
  clip: string;
  z: string;
  masks: number;
  triggerCovered: boolean | null;
  outsideCovered: boolean | null;
};

type OverlayBackdropCloseSample = {
  mode: 'close' | 'reopen';
  timedOut: boolean;
  frames: OverlayBackdropCloseFrame[];
};

type OverlayBackdropCloseWindow = Window & {
  __overlayBackdropClose?: Promise<OverlayBackdropCloseSample>;
  __overlayBackdropFade?: Promise<number>;
};

// Armed before the user closes the layer. Every animation frame records the scrim level
// (opacity x background alpha), its clip-path and z-index, the visible native masks, and whether
// it paints over the trigger centre or, for a nested popup, the viewport outside the host dialog.
// Nothing is paused, forced or slept; sampling ends once the scrim is gone (close) or back (reopen).
async function overlayBackdropArmClose(
  page: Page,
  facts: Record<string, unknown> | null,
  mode: OverlayBackdropCloseSample['mode'],
): Promise<void> {
  const rects = facts?.rects as { trigger?: { cx: number; cy: number } } | undefined;
  const outsidePoint = facts?.outsidePoint;
  await page.evaluate(
    ({ trigger, outside, sampleMode }) => {
      const w = window as OverlayBackdropCloseWindow;
      const num = (v: string) => Number.parseFloat(v) || 0;
      const alphaOf = (v: string) => {
        const value = v.trim().toLowerCase();
        if (value === '' || value === 'transparent') return 0;
        const slash = value.lastIndexOf('/');
        if (slash >= 0) {
          const raw = value
            .slice(slash + 1)
            .replace(')', '')
            .trim();
          return raw.endsWith('%') ? num(raw) / 100 : num(raw);
        }
        if (value.startsWith('rgba(')) {
          const parts = value.slice(5, -1).split(',');
          return parts.length === 4 ? num(parts[3]) : 1;
        }
        return 1;
      };
      const ctx = document.createElement('canvas').getContext('2d');
      const covers = (clip: string, point: number[] | null): boolean | null => {
        if (!point) return null;
        if (clip === 'none' || clip === '') return true;
        const m = clip.match(/^path\((?:(evenodd|nonzero)\s*,\s*)?['"]([^'"]*)['"]\)$/);
        if (!m || !ctx) return null;
        return ctx.isPointInPath(
          new Path2D(m[2]),
          point[0],
          point[1],
          m[1] === 'evenodd' ? 'evenodd' : 'nonzero',
        );
      };
      const read = (): OverlayBackdropCloseFrame => {
        const ps = getComputedStyle(document.body, '::before');
        const on =
          !/^(none|normal)$/.test(ps.content) &&
          ps.display !== 'none' &&
          ps.visibility !== 'hidden';
        const opacity = num(ps.opacity);
        const alpha = alphaOf(ps.backgroundColor);
        const level = on ? Math.round(opacity * alpha * 10_000) / 10_000 : 0;
        const masks = Array.from(
          document.querySelectorAll('.ant-drawer-mask, .ant-modal-mask'),
        ).filter(el => {
          const s = getComputedStyle(el);
          return (
            s.display !== 'none' &&
            s.visibility !== 'hidden' &&
            num(s.opacity) > 0 &&
            el.getClientRects().length > 0 &&
            alphaOf(s.backgroundColor) > 0
          );
        }).length;
        return {
          t: Math.round(performance.now()),
          level,
          opacity,
          alpha,
          clip: ps.clipPath,
          z: ps.zIndex,
          masks,
          triggerCovered: level > 0 ? covers(ps.clipPath, trigger) : false,
          outsideCovered: level > 0 ? covers(ps.clipPath, outside) : false,
        };
      };
      let fade: (level: number) => void = () => {};
      w.__overlayBackdropFade = new Promise<number>(done => {
        fade = done;
      });
      w.__overlayBackdropClose = new Promise<OverlayBackdropCloseSample>(done => {
        const frames: OverlayBackdropCloseFrame[] = [];
        const started = performance.now();
        let dipped = false;
        let zeros = 0;
        let back = 0;
        const tick = () => {
          const frame = read();
          frames.push(frame);
          const peak = frames[0].level;
          if (!dipped && frame.level < peak - 0.001) {
            dipped = true;
            fade(frame.level);
          }
          zeros = frame.level === 0 ? zeros + 1 : 0;
          back = dipped && frame.level >= peak - 0.001 ? back + 1 : 0;
          const finished = sampleMode === 'close' ? zeros >= 2 : back >= 3;
          if (finished || performance.now() - started > 4_000) {
            fade(frame.level);
            done({ mode: sampleMode, timedOut: !finished, frames });
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    },
    {
      trigger: rects?.trigger ? [rects.trigger.cx, rects.trigger.cy] : null,
      outside: Array.isArray(outsidePoint) ? (outsidePoint as number[]) : null,
      sampleMode: mode,
    },
  );
}

async function overlayBackdropCloseFrames(page: Page): Promise<OverlayBackdropCloseSample> {
  const sample = await page.evaluate(
    () => (window as OverlayBackdropCloseWindow).__overlayBackdropClose ?? null,
  );
  return sample ?? { mode: 'close', timedOut: true, frames: [] };
}

// Close contract: the scrim fades out monotonically, keeps the clip/z of its last fully open frame
// until the fade ends, never paints over the trigger and never stacks a second background scrim.
// A reopen during the fade may only bring the level back up; reduced motion closes instantly.
function overlayBackdropCloseIssues(
  sample: OverlayBackdropCloseSample,
  options: { nested: boolean; reduced: boolean },
): string[] {
  const issues = new Map<string, string>();
  const note = (id: string, message: string) => {
    if (!issues.has(id)) issues.set(id, message);
  };
  const frames = sample.frames;
  const peak = frames[0]?.level ?? 0;
  let lastFull = frames[0];
  let previous = peak;
  let dipped = false;
  let rising = false;
  if (sample.timedOut)
    note(
      'timeout',
      `scrim did not ${sample.mode === 'reopen' ? 'come back after the interrupted close' : 'finish its close'} within 4000ms (last level ${frames[frames.length - 1]?.level ?? 'n/a'})`,
    );
  frames.forEach((frame, index) => {
    const at = `frame ${index} (level ${frame.level}, clip ${frame.clip}, z ${frame.z})`;
    if (!dipped && frame.level >= peak - 0.001) lastFull = frame;
    else dipped = true;
    if (frame.level > previous + 0.001) {
      if (sample.mode === 'reopen') rising = true;
      else
        note(
          'monotonic',
          `scrim level rose from ${previous} at ${at}; the close fade must decrease monotonically`,
        );
    } else if (rising && frame.level < previous - 0.001)
      note('reopen-fall', `scrim level fell again after the reopen at ${at}`);
    previous = frame.level;
    if (
      dipped &&
      !rising &&
      frame.level > 0 &&
      lastFull &&
      (frame.clip !== lastFull.clip || frame.z !== lastFull.z)
    )
      note(
        'retain',
        `fading scrim must keep its last clip/z until the fade finishes: ${at} after clip ${lastFull.clip}, z ${lastFull.z}`,
      );
    if (frame.triggerCovered === true)
      note('trigger', `scrim paints over the trigger centre at ${at}`);
    const scrims = options.nested
      ? (frame.outsideCovered === true ? 1 : 0) + (frame.masks > 0 ? 1 : 0)
      : (frame.level > 0 ? 1 : 0) + frame.masks;
    if (scrims > 1)
      note(
        'double',
        `${scrims} background scrims overlap at ${at} (native masks ${frame.masks}); exactly one may dim the background`,
      );
  });
  if (sample.mode === 'reopen' && !dipped)
    note('no-dip', 'Escape never started the scrim close, so the reopen could not interrupt it');
  if (options.reduced) {
    const between = frames.filter(
      frame => frame.level > 0.001 && frame.level < peak - 0.001,
    ).length;
    if (between > 0)
      note(
        'reduced',
        `reduced motion close is not instant: ${between} intermediate scrim frame(s)`,
      );
  }
  return [...issues.values()];
}

// The controller is imported by SSR-rendered Astro pages, so loading the module (and calling the
// installer) must not throw where window/document do not exist. The real source is bundled with
// the pinned esbuild and imported by a separate Node process that has no DOM globals.
async function overlayBackdropSsrImport(
  testInfo: TestInfo,
): Promise<{ issues: string[]; facts: Record<string, unknown> }> {
  const source = resolvePath(dirname(testInfo.file), '../src/overlay-backdrop.ts');
  const issues: string[] = [];
  const facts: Record<string, unknown> = { source, node: process.version };
  try {
    const loaded = await import('esbuild');
    const esbuild = (loaded as unknown as { default?: typeof loaded }).default ?? loaded;
    facts.esbuild = esbuild.version;
    const bundled = await esbuild.build({
      entryPoints: [source],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      write: false,
      logLevel: 'silent',
    });
    const modulePath = testInfo.outputPath('overlay-backdrop-ssr.mjs');
    mkdirSync(dirname(modulePath), { recursive: true });
    writeFileSync(modulePath, bundled.outputFiles?.[0]?.text ?? '');
    const probe = [
      'const result = { window: typeof globalThis.window, document: typeof globalThis.document, loaded: false, disposer: null, error: null };',
      'try {',
      `  const mod = await import(${JSON.stringify(pathToFileURL(modulePath).href)});`,
      '  result.loaded = true;',
      '  const dispose = mod.installOverlayBackdrop();',
      '  result.disposer = typeof dispose;',
      `  if (typeof dispose === 'function') dispose();`,
      '} catch (error) {',
      '  result.error = String((error && error.stack) || error);',
      '}',
      'process.stdout.write(JSON.stringify(result));',
    ].join('\n');
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      cwd: dirname(modulePath),
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
      timeout: 20_000,
    });
    facts.exit = run.status;
    facts.stderr = (run.stderr ?? '').slice(0, 2000);
    let result: {
      window: string;
      document: string;
      loaded: boolean;
      disposer: string | null;
      error: string | null;
    } | null = null;
    try {
      result = JSON.parse(run.stdout ?? '');
    } catch {
      issues.push(
        `SSR probe returned no result (exit ${run.status}): ${String(run.error ?? run.stderr).slice(0, 300)}`,
      );
    }
    facts.result = result;
    if (result) {
      const firstLine = (result.error ?? '').split('\n')[0];
      if (result.window !== 'undefined' || result.document !== 'undefined')
        issues.push(`SSR probe still sees window=${result.window} document=${result.document}`);
      if (!result.loaded)
        issues.push(
          `importing overlay-backdrop without window/document throws on module load: ${firstLine}`,
        );
      else if (result.error)
        issues.push(`installOverlayBackdrop() throws without window/document: ${firstLine}`);
      else if (result.disposer !== 'function')
        issues.push(
          `installOverlayBackdrop() must return a disposer without window/document, got ${result.disposer}`,
        );
    }
  } catch (error) {
    issues.push(
      `SSR import probe could not bundle ${source} with the pinned esbuild: ${String(
        (error as Error).message ?? error,
      )
        .replace(/\s+/g, ' ')
        .slice(0, 300)}`,
    );
  }
  return { issues, facts };
}

const overlayBackdropLegacyRecipe = {
  version: 1,
  light: {
    primary: '#aa3399',
    text: '#242622',
    muted: '#575a53',
    canvas: '#e6e2d7',
    panel: '#fffefa',
    field: '#ded9cc',
    border: '#747166',
    divider: '#d5dae1',
    success: '#237804',
    info: '#005fb3',
    warning: '#874d00',
    danger: '#a8071a',
    'disabled-bg': '#ded9cc',
    'disabled-text': '#575a53',
    'border-width': 1,
    'space-local-sm': 12,
    'space-local-md': 16,
    'space-local-lg': 24,
    'space-section-sm': 32,
    'space-section-md': 48,
    'space-section-lg': 64,
    'space-layout-sm': 96,
    'space-layout-md': 144,
    'space-layout-lg': 240,
    'inset-control-sm': 4,
    'inset-control-md': 8,
    'inset-control-lg': 12,
    'inset-container-sm': 16,
    'inset-container-md': 24,
    'inset-container-lg': 32,
    'inset-page-sm': 48,
    'inset-page-md': 80,
    'inset-page-lg': 120,
    'radius-sm': 3,
    'radius-md': 5,
    'radius-lg': 8,
    'size-sm': 48,
    'size-md': 56,
    'size-lg': 64,
    'text-body': 14,
    'text-label': 14,
    'text-helper': 14,
    'text-table': 14,
    'text-heading': 24,
    'text-code': 14,
    'shadow-sm': 6,
    'shadow-md': 12,
    'shadow-lg': 20,
    density: 'standard',
    surface: 'inset',
    'border-style': 'solid',
  },
  dark: {
    primary: '#aa3399',
    text: '#f2f2f2',
    muted: '#b8b8b8',
    canvas: '#242424',
    panel: '#2c2c2c',
    field: '#1b1b1b',
    border: '#858585',
    divider: '#48515d',
    success: '#95de64',
    info: '#50bef5',
    warning: '#ffd666',
    danger: '#ff7875',
    'disabled-bg': '#1b1b1b',
    'disabled-text': '#b8b8b8',
    'border-width': 1,
    'space-local-sm': 12,
    'space-local-md': 16,
    'space-local-lg': 24,
    'space-section-sm': 32,
    'space-section-md': 48,
    'space-section-lg': 64,
    'space-layout-sm': 96,
    'space-layout-md': 144,
    'space-layout-lg': 240,
    'inset-control-sm': 4,
    'inset-control-md': 8,
    'inset-control-lg': 12,
    'inset-container-sm': 16,
    'inset-container-md': 24,
    'inset-container-lg': 32,
    'inset-page-sm': 48,
    'inset-page-md': 80,
    'inset-page-lg': 120,
    'radius-sm': 3,
    'radius-md': 5,
    'radius-lg': 8,
    'size-sm': 48,
    'size-md': 56,
    'size-lg': 64,
    'text-body': 14,
    'text-label': 14,
    'text-helper': 14,
    'text-table': 14,
    'text-heading': 24,
    'text-code': 14,
    'shadow-sm': 6,
    'shadow-md': 12,
    'shadow-lg': 20,
    density: 'standard',
    surface: 'inset',
    'border-style': 'solid',
  },
};

test('overlay backdrop: shared one-pixel blur and neutral scrim across user-opened layers', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300000);
  const overlayBackdropPhase = process.env.ATLAS_OVERLAY_PHASE ?? 'before';
  const overlayBackdropRowFilter = (process.env.ATLAS_OVERLAY_ROWS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value !== '');
  const overlayBackdropUnknownKeys = overlayBackdropRowFilter.filter(
    selected => !overlayBackdropRows.some(row => row.key === selected),
  );
  if (overlayBackdropUnknownKeys.length > 0) {
    throw new Error(
      `ATLAS_OVERLAY_ROWS names unknown row key(s): ${overlayBackdropUnknownKeys.join(', ')}. Known keys: ${overlayBackdropRows.map(row => row.key).join(', ')}`,
    );
  }
  const overlayBackdropSelectedRows =
    overlayBackdropRowFilter.length === 0
      ? overlayBackdropRows
      : overlayBackdropRows.filter(row => overlayBackdropRowFilter.includes(row.key));
  if (overlayBackdropSelectedRows.length === 0)
    throw new Error('ATLAS_OVERLAY_ROWS selected no rows');
  const overlayBackdropBrowser = browser.version();
  const overlayBackdropFailures: string[] = [];
  const overlayBackdropAggregate: Record<string, unknown>[] = [];
  let overlayBackdropOutsideClickDone = false;
  const overlayBackdropReducedMotionFacts: Record<string, unknown>[] = [];
  const overlayBackdropSettle = async (page: Page) => {
    await page.evaluate(async () => {
      const overlayBackdropTwoFrames = () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      await overlayBackdropTwoFrames();
      const overlayBackdropFiniteAnimations = document.getAnimations().filter(animation => {
        const endTime = animation.effect?.getComputedTiming().endTime;
        return typeof endTime === 'number' && Number.isFinite(endTime);
      });
      await Promise.allSettled(
        overlayBackdropFiniteAnimations.map(animation => animation.finished),
      );
      await overlayBackdropTwoFrames();
      await document.fonts.ready;
    });
  };
  const overlayBackdropBodyEffects = (page: Page) =>
    page.evaluate(() => {
      const alphaOf = (color: string) => {
        const value = color.trim().toLowerCase();
        if (value === '' || value === 'transparent') return 0;
        const slash = value.lastIndexOf('/');
        if (slash >= 0) {
          const raw = value
            .slice(slash + 1)
            .replace(')', '')
            .trim();
          return raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
        }
        if (value.startsWith('rgba(')) {
          const parts = value.slice(5, -1).split(',');
          return parts.length === 4 ? Number.parseFloat(parts[3]) : 1;
        }
        return 1;
      };
      const blurOf = (value: string) => {
        const index = value.indexOf('blur(');
        return index >= 0 ? Number.parseFloat(value.slice(index + 5)) : 0;
      };
      const before = getComputedStyle(document.body, '::before');
      const beforeVisible =
        before.content !== 'none' &&
        before.content !== 'normal' &&
        before.display !== 'none' &&
        before.visibility !== 'hidden' &&
        Number.parseFloat(before.opacity) > 0;
      const beforeActive =
        beforeVisible && (blurOf(before.backdropFilter) > 0 || alphaOf(before.backgroundColor) > 0);
      const nativeMasks = Array.from(
        document.querySelectorAll<HTMLElement>('.ant-drawer-mask, .ant-modal-mask'),
      ).filter(element => {
        const style = getComputedStyle(element);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number.parseFloat(style.opacity) <= 0 ||
          element.getClientRects().length === 0
        )
          return false;
        return alphaOf(style.backgroundColor) > 0 || blurOf(style.backdropFilter) > 0;
      }).length;
      return {
        bodyFilter: getComputedStyle(document.body).filter,
        masks: (beforeActive ? 1 : 0) + nativeMasks,
        bodyBeforeActive: beforeActive,
        nativeMasks,
      };
    });
  const overlayBackdropHidden = async (
    popup: OverlayBackdropLocator,
    key: string,
    step: string,
  ) => {
    try {
      await expect(popup).toBeHidden({ timeout: 5000 });
    } catch {
      overlayBackdropFailures.push(`${key}: popup still visible after ${step}`);
    }
  };
  const overlayBackdropCloseFacts: Record<string, unknown>[] = [];
  const overlayBackdropCloseRecord = (
    key: string,
    via: string,
    sample: OverlayBackdropCloseSample,
    options: { nested: boolean; reduced: boolean },
  ) => {
    const issues = overlayBackdropCloseIssues(sample, options);
    overlayBackdropCloseFacts.push({
      key,
      via,
      ...options,
      mode: sample.mode,
      timedOut: sample.timedOut,
      issues,
      frames: sample.frames,
    });
    for (const issue of issues)
      overlayBackdropFailures.push(`${key}: close frames (${via}): ${issue}`);
  };
  const overlayBackdropCleared = async (page: Page, key: string) => {
    let effects = await overlayBackdropBodyEffects(page);
    try {
      await expect
        .poll(
          async () => {
            effects = await overlayBackdropBodyEffects(page);
            return effects.bodyFilter === 'none' && effects.masks === 0;
          },
          { timeout: 5000, message: `${key}: background effect did not clear after close` },
        )
        .toBe(true);
    } catch {
      // Keep the last polled sample; the check below reports the remaining effect.
    }
    if (effects.bodyFilter !== 'none' || effects.masks > 0)
      overlayBackdropFailures.push(
        `${key}: background effect remains after close (filter=${effects.bodyFilter}, masks=${effects.masks}, bodyBefore=${effects.bodyBeforeActive}, native=${effects.nativeMasks})`,
      );
  };
  const overlayBackdropSsr = await overlayBackdropSsrImport(testInfo);
  for (const issue of overlayBackdropSsr.issues)
    overlayBackdropFailures.push(`ssr-import: ${issue}`);

  for (const width of [320, 1440]) {
    for (const mode of ['dark', 'light'] as const) {
      for (const row of overlayBackdropSelectedRows) {
        const key = `${row.key}-${mode}-${width}`;
        const context = await browser.newContext({
          baseURL: 'http://127.0.0.1:4324',
          viewport: { width, height: width === 320 ? 720 : 1000 },
          locale: 'en',
          colorScheme: mode,
        });
        try {
          await context.addInitScript(
            ({ theme, legacy, recipe }) => {
              localStorage.setItem('atlas-theme', theme);
              localStorage.setItem('atlas-locale', 'en');
              if (legacy) localStorage.setItem('atlas-theme-builder-v1', JSON.stringify(recipe));
            },
            { theme: mode, legacy: row.legacy === true, recipe: overlayBackdropLegacyRecipe },
          );
          const page = await context.newPage();
          await page.goto(row.route);
          if (row.legacy) {
            try {
              await expect(page.locator('body')).toHaveAttribute('data-atlas-builder', 'active', {
                timeout: 5000,
              });
            } catch {
              overlayBackdropFailures.push(
                `${key}: body[data-atlas-builder] is not active after hydrate`,
              );
            }
          }
          if (row.widths && !row.widths.includes(width)) {
            // Not available at this width (the docs sidebar is inline from 875px). Prove that from
            // the real shell instead of unhiding the toggle or forcing showModal().
            const naIssues: string[] = [];
            try {
              await expect(page.locator('[data-docs-shell]')).toHaveAttribute(
                'data-docs-shell-ready',
                '',
                { timeout: 5000 },
              );
            } catch {
              naIssues.push('docs shell never became ready');
            }
            const availability = await page.evaluate(toggleSelector => {
              const toggle = document.querySelector(toggleSelector);
              const drawer = document.querySelector('dialog[data-docs-drawer]');
              const sidebar = document.querySelector('[data-docs-shell] aside.sidebar');
              return {
                wide: matchMedia('(min-width: 54.6875rem)').matches,
                toggleDisplay: toggle ? getComputedStyle(toggle).display : null,
                drawerOpen: drawer instanceof HTMLDialogElement ? drawer.open : null,
                sidebarInDrawer: !!sidebar && !!drawer?.contains(sidebar),
                sidebarVisible: !!sidebar && sidebar.getClientRects().length > 0,
              };
            }, row.selector ?? '[data-docs-menu-toggle]');
            if (!availability.wide)
              naIssues.push(`viewport ${width} is below the sidebar breakpoint`);
            if (availability.toggleDisplay !== 'none')
              naIssues.push(`menu toggle is exposed (display ${availability.toggleDisplay})`);
            if (availability.drawerOpen !== false)
              naIssues.push(`drawer open state is ${availability.drawerOpen}`);
            if (availability.sidebarInDrawer || !availability.sidebarVisible)
              naIssues.push('navigation sidebar is not visible inline in the shell grid');
            const naRecord = {
              phase: overlayBackdropPhase,
              browser: overlayBackdropBrowser,
              key: row.key,
              route: row.route,
              kind: row.kind,
              mode,
              width,
              status: 'not_applicable',
              reason: `layer exists only at widths ${row.widths.join(', ')}`,
              issues: naIssues,
              facts: { availability },
            };
            overlayBackdropAggregate.push(naRecord);
            await testInfo.attach(`${overlayBackdropPhase}-${key}.json`, {
              body: JSON.stringify(naRecord, null, 2),
              contentType: 'application/json',
            });
            for (const issue of naIssues)
              overlayBackdropFailures.push(`${key}: not_applicable check: ${issue}`);
            continue;
          }
          let opened: Awaited<ReturnType<typeof overlayBackdropOpen>>;
          try {
            opened = await overlayBackdropOpen(page, row);
          } catch (error) {
            overlayBackdropFailures.push(
              `OPEN_FAILURE ${key}: ${String((error as Error).message ?? error)
                .replace(/\s+/g, ' ')
                .slice(0, 200)}`,
            );
            continue;
          }
          await overlayBackdropSettle(page);
          const measured = await overlayBackdropMeasure(
            page,
            opened.popup,
            opened.trigger,
            row.kind,
          );
          await page.screenshot({
            path: testInfo.outputPath(`${overlayBackdropPhase}-${key}.png`),
          });
          const record = {
            phase: overlayBackdropPhase,
            browser: overlayBackdropBrowser,
            key: row.key,
            route: row.route,
            kind: row.kind,
            mode,
            width,
            via: row.tooltip ? 'hover' : 'click',
            issues: measured.issues,
            facts: measured.facts,
          };
          overlayBackdropAggregate.push(record);
          await testInfo.attach(`${overlayBackdropPhase}-${key}.json`, {
            body: JSON.stringify(record, null, 2),
            contentType: 'application/json',
          });
          for (const issue of measured.issues) overlayBackdropFailures.push(`${key}: ${issue}`);
          if (row.kind === 'negative') continue;
          const closeSampled = row.kind === 'nonmodal';
          if (closeSampled) await overlayBackdropArmClose(page, measured.facts, 'close');
          const closeVia = row.tooltip ? 'pointer leave' : row.close ? 'close button' : 'Escape';
          if (row.tooltip) await page.mouse.move(1, 1);
          else if (row.close)
            await page.locator(row.close).filter({ visible: true }).first().click();
          else await page.keyboard.press('Escape');
          await overlayBackdropHidden(opened.popup, key, closeVia);
          if (closeSampled)
            overlayBackdropCloseRecord(key, closeVia, await overlayBackdropCloseFrames(page), {
              nested: row.nested === true,
              reduced: false,
            });
          await overlayBackdropSettle(page);
          let effects = await overlayBackdropBodyEffects(page);
          if (row.nested && effects.masks > 0) {
            await page.keyboard.press('Escape');
            await overlayBackdropSettle(page);
            effects = await overlayBackdropBodyEffects(page);
          }
          // Close oracle: the semantic close above resolves while the native mask may
          // still be in its leave motion (.ant-drawer-mask-motion-leave-start/active).
          // Wait, bounded and without a fixed sleep, for the real native mask to finish
          // leaving before the final background-effect assertion below.
          try {
            await expect
              .poll(
                async () => {
                  effects = await overlayBackdropBodyEffects(page);
                  return effects.bodyFilter === 'none' && effects.masks === 0;
                },
                {
                  timeout: 5000,
                  message: `${key}: native mask leave motion did not finish after close`,
                },
              )
              .toBe(true);
          } catch {
            // Keep the last polled sample; the assertion below reports the remaining effect.
          }
          if (effects.bodyFilter !== 'none' || effects.masks > 0) {
            overlayBackdropFailures.push(
              `${key}: background effect remains after close (filter=${effects.bodyFilter}, masks=${effects.masks}, bodyBefore=${effects.bodyBeforeActive}, native=${effects.nativeMasks})`,
            );
          }
          if (row.kind === 'native') {
            // Dismissal standard: focus returns to the real toggle; under reduced motion the native
            // backdrop opens and closes without a transition.
            try {
              await expect(opened.trigger).toBeFocused({ timeout: 5000 });
            } catch {
              overlayBackdropFailures.push(
                `${key}: focus did not return to the trigger after ${closeVia}`,
              );
            }
            const expanded = await opened.trigger.getAttribute('aria-expanded');
            if (expanded !== 'false')
              overlayBackdropFailures.push(
                `${key}: trigger aria-expanded is ${expanded} after close`,
              );
            const reducedKey = `${row.key}-reduced-${mode}-${width}`;
            await page.emulateMedia({ reducedMotion: 'reduce' });
            let reduced: Awaited<ReturnType<typeof overlayBackdropOpen>> | null = null;
            try {
              reduced = await overlayBackdropOpen(page, row);
            } catch (error) {
              overlayBackdropFailures.push(
                `OPEN_FAILURE ${reducedKey}: ${String((error as Error).message ?? error)
                  .replace(/\s+/g, ' ')
                  .slice(0, 200)}`,
              );
            }
            if (reduced) {
              await overlayBackdropSettle(page);
              const backdropTiming = await reduced.popup.evaluate(el => {
                const b = getComputedStyle(el, '::backdrop');
                return {
                  transitionDuration: b.transitionDuration,
                  transitionTimingFunction: b.transitionTimingFunction,
                  backgroundColor: b.backgroundColor,
                  backdropFilter: b.backdropFilter,
                };
              });
              overlayBackdropReducedMotionFacts.push({
                key: row.key,
                route: row.route,
                mode,
                width,
                backdrop: backdropTiming,
              });
              const backdropRunning = backdropTiming.transitionDuration
                .split(',')
                .map(value => value.trim())
                .filter(value => value !== '' && Number.parseFloat(value) > 0);
              if (backdropRunning.length > 0)
                overlayBackdropFailures.push(
                  `${reducedKey}: dialog::backdrop transition-duration ${backdropTiming.transitionDuration} is not zero under reduced motion`,
                );
              await page.keyboard.press('Escape');
              await overlayBackdropHidden(reduced.popup, reducedKey, 'Escape under reduced motion');
              try {
                await expect(reduced.trigger).toBeFocused({ timeout: 5000 });
              } catch {
                overlayBackdropFailures.push(
                  `${reducedKey}: focus did not return to the trigger after Escape`,
                );
              }
            }
          }
          if (row.tooltip) {
            // Same tooltip row, opened again by real keyboard focus and closed by moving focus away.
            const focusKey = `${row.key}-focus-${mode}-${width}`;
            let focused: Awaited<ReturnType<typeof overlayBackdropOpen>> | null = null;
            try {
              focused = await overlayBackdropOpen(page, row, 'focus');
            } catch (error) {
              overlayBackdropFailures.push(
                `OPEN_FAILURE ${focusKey}: ${String((error as Error).message ?? error)
                  .replace(/\s+/g, ' ')
                  .slice(0, 200)}`,
              );
            }
            if (focused) {
              await overlayBackdropSettle(page);
              const focusMeasured = await overlayBackdropMeasure(
                page,
                focused.popup,
                focused.trigger,
                row.kind,
              );
              await page.screenshot({
                path: testInfo.outputPath(`${overlayBackdropPhase}-${focusKey}.png`),
              });
              const focusRecord = {
                ...record,
                via: 'focus',
                issues: focusMeasured.issues,
                facts: focusMeasured.facts,
              };
              overlayBackdropAggregate.push(focusRecord);
              await testInfo.attach(`${overlayBackdropPhase}-${focusKey}.json`, {
                body: JSON.stringify(focusRecord, null, 2),
                contentType: 'application/json',
              });
              for (const issue of focusMeasured.issues)
                overlayBackdropFailures.push(`${focusKey}: ${issue}`);
              await overlayBackdropArmClose(page, focusMeasured.facts, 'close');
              await page.keyboard.press('Shift+Tab');
              await overlayBackdropHidden(focused.popup, focusKey, 'Shift+Tab focus leave');
              overlayBackdropCloseRecord(
                focusKey,
                'focus leave',
                await overlayBackdropCloseFrames(page),
                { nested: false, reduced: false },
              );
              await overlayBackdropSettle(page);
              await overlayBackdropCleared(page, focusKey);
            }
          }
          if (row.legacy) {
            const stored =
              JSON.parse(
                await page.evaluate(() => localStorage.getItem('atlas-theme-builder-v1') ?? 'null'),
              ) ?? {};
            if (stored.version !== overlayBackdropLegacyRecipe.version)
              overlayBackdropFailures.push(
                `${key}: legacy recipe version ${String(stored.version)} !== 1`,
              );
            for (const scheme of ['light', 'dark'] as const) {
              for (const [token, value] of Object.entries(overlayBackdropLegacyRecipe[scheme])) {
                if (stored[scheme]?.[token] !== value)
                  overlayBackdropFailures.push(
                    `${key}: legacy ${scheme}.${token} ${String(value)} -> ${String(stored[scheme]?.[token])}`,
                  );
              }
            }
          }
          if (
            width === 1440 &&
            mode === 'light' &&
            /dropdown/i.test(row.key) &&
            !overlayBackdropOutsideClickDone
          ) {
            overlayBackdropOutsideClickDone = true;
            const reopened = await overlayBackdropOpen(page, row);
            await overlayBackdropSettle(page);
            await page.mouse.click(5, 5);
            await overlayBackdropHidden(reopened.popup, key, 'outside click');
            await overlayBackdropSettle(page);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const reduced = await overlayBackdropOpen(page, row);
            await overlayBackdropSettle(page);
            const scrimTiming = await page.evaluate(() => {
              const before = getComputedStyle(document.body, '::before');
              return {
                content: before.content,
                transitionDuration: before.transitionDuration,
                animationDuration: before.animationDuration,
                backdropFilter: before.backdropFilter,
                backgroundColor: before.backgroundColor,
              };
            });
            overlayBackdropReducedMotionFacts.push({
              key: row.key,
              route: row.route,
              mode,
              width,
              bodyBefore: scrimTiming,
            });
            const scrimTransitionRunning = scrimTiming.transitionDuration
              .split(',')
              .map(value => value.trim())
              .filter(value => value !== '' && Number.parseFloat(value) > 0);
            if (scrimTransitionRunning.length > 0)
              overlayBackdropFailures.push(
                `${key}: body::before scrim transition-duration ${scrimTiming.transitionDuration} is not zero under reduced motion`,
              );
            await overlayBackdropArmClose(page, null, 'close');
            await page.keyboard.press('Escape');
            await overlayBackdropHidden(reduced.popup, key, 'Escape under reduced motion');
            overlayBackdropCloseRecord(
              `${row.key}-reduced-${mode}-${width}`,
              'Escape under reduced motion',
              await overlayBackdropCloseFrames(page),
              { nested: false, reduced: true },
            );
          }
        } finally {
          await context.close();
        }
      }
    }
  }
  await testInfo.attach('overlay-backdrop-facts.json', {
    body: JSON.stringify(
      {
        phase: overlayBackdropPhase,
        browser: overlayBackdropBrowser,
        rowFilter: overlayBackdropRowFilter,
        selectedKeys: overlayBackdropSelectedRows.map(row => row.key),
        rows: overlayBackdropAggregate,
        reducedMotion: overlayBackdropReducedMotionFacts,
        close: overlayBackdropCloseFacts,
        ssrImport: overlayBackdropSsr.facts,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(overlayBackdropFailures, overlayBackdropFailures.join('\n')).toEqual([]);
});
