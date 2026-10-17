import { expect, test } from '@playwright/test';

const clippedControl = (control: {
  rect: { left: number; right: number; top: number; bottom: number };
  clips: {
    rect: { left: number; right: number; top: number; bottom: number };
    x: boolean;
    y: boolean;
  }[];
}) =>
  control.clips.some(
    clip =>
      (clip.x &&
        (control.rect.left < clip.rect.left - 1 || control.rect.right > clip.rect.right + 1)) ||
      (clip.y &&
        (control.rect.top < clip.rect.top - 1 || control.rect.bottom > clip.rect.bottom + 1)),
  );

for (const width of [320, 1280]) {
  test(`Breadcrumb geometry and long-label reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/components/breadcrumb/');
    const catalog = page.locator('[data-breadcrumb-catalog]');
    await expect(catalog).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const syntheticLongLabels of [false, true]) {
      if (syntheticLongLabels) {
        // Layout-only fixture: alter text nodes, never business state or control
        // structure. This proves long-content reflow, not a React update contract.
        await catalog
          .locator('#breadcrumb-quick .genux-breadcrumb-link > span')
          .nth(1)
          .evaluate(el => {
            el.textContent = 'Müşteri sözleşmeleri ve uyumluluk belgeleri çalışma alanı';
          });
        await catalog.locator('#breadcrumb-quick .genux-breadcrumb-current > span').evaluate(el => {
          el.textContent = 'Customer onboarding documentation and approval history';
        });
      }
      const readMetrics = () =>
        catalog.evaluate(root => {
          const length = (el: Element, expression: string) => {
            const probe = document.createElement('span');
            Object.assign(probe.style, {
              position: 'absolute',
              display: 'block',
              visibility: 'hidden',
              width: expression,
              minWidth: '0',
              maxWidth: 'none',
              height: '0',
              padding: '0',
              border: '0',
              margin: '0',
            });
            el.append(probe);
            const value = Number.parseFloat(getComputedStyle(probe).width);
            probe.remove();
            return value;
          };
          const clipsFor = (el: Element) => {
            const result = [];
            let a = el.parentElement;
            while (a) {
              const style = getComputedStyle(a);
              const x = /hidden|clip|scroll|auto/.test(style.overflowX),
                y = /hidden|clip|scroll|auto/.test(style.overflowY);
              if (x || y) {
                const r = a.getBoundingClientRect();
                const sx = a.offsetWidth ? r.width / a.offsetWidth : 1,
                  sy = a.offsetHeight ? r.height / a.offsetHeight : 1;
                const left = r.left + a.clientLeft * sx,
                  top = r.top + a.clientTop * sy;
                result.push({
                  x,
                  y,
                  rect: {
                    left,
                    top,
                    right: left + a.clientWidth * sx,
                    bottom: top + a.clientHeight * sy,
                  },
                });
              }
              a = a.parentElement;
            }
            return result;
          };
          const rect = (el: Element) => {
            const r = el.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
              center: r.top + r.height / 2,
            };
          };
          return {
            viewport: innerWidth,
            page: document.documentElement.scrollWidth,
            rows: [...root.querySelectorAll('.genux-breadcrumb-nav')].map(nav => ({
              gap: getComputedStyle(nav.querySelector('ol')!).rowGap,
              owners: [...nav.querySelectorAll('ol > li')].map(el => ({
                rect: rect(el),
                margin: getComputedStyle(el).margin,
                separators: [...el.querySelectorAll('.ant-breadcrumb-separator')].map(rect),
                destination: rect(
                  el.querySelector('.genux-breadcrumb-link,.genux-breadcrumb-current')!,
                ),
                parts: [
                  ...el.querySelectorAll(
                    '.ant-breadcrumb-separator,.genux-breadcrumb-link,.genux-breadcrumb-current,.genux-breadcrumb-trigger',
                  ),
                ].map(rect),
              })),
            })),
            labels: [
              ...root.querySelectorAll(
                '.genux-breadcrumb-link > span,.genux-breadcrumb-current > span',
              ),
            ].map(el => {
              const range = document.createRange();
              range.selectNodeContents(el);
              return {
                text: el.textContent,
                rect: rect(el),
                destination: rect(el.closest('.genux-breadcrumb-link,.genux-breadcrumb-current')!),
                owner: rect(el.closest('li')!),
                clips: (() => {
                  const clips = [];
                  let ancestor = el.parentElement;
                  while (ancestor) {
                    const style = getComputedStyle(ancestor);
                    if (/hidden|clip|scroll|auto/.test(style.overflowX + ' ' + style.overflowY))
                      clips.push({
                        rect: rect(ancestor),
                        x: /hidden|clip|scroll|auto/.test(style.overflowX),
                        y: /hidden|clip|scroll|auto/.test(style.overflowY),
                      });
                    ancestor = ancestor.parentElement;
                  }
                  return clips;
                })(),
                lines: [...range.getClientRects()].map(r => ({
                  left: r.left,
                  right: r.right,
                  top: r.top,
                  bottom: r.bottom,
                })),
                whiteSpace: getComputedStyle(el).whiteSpace,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
              };
            }),
            links: [...root.querySelectorAll('.genux-breadcrumb-link')].map(el => ({
              rect: rect(el),
              owner: rect(el.closest('li')!),
              clips: clipsFor(el),
              heightMinimum: length(el, 'max(var(--genux-component-height),var(--target-min))'),
              iconOnly: !!el.querySelector('svg:only-child'),
              widthMinimum: length(el, 'var(--target-min)'),
            })),
            triggers: [...root.querySelectorAll('.genux-breadcrumb-trigger')].map(trigger => ({
              rect: rect(trigger),
              owner: rect(trigger.closest('li')!),
              clips: clipsFor(trigger),
              width: rect(trigger).width,
              height: rect(trigger).height,
              gap:
                rect(trigger.querySelector('svg')!).left -
                rect(trigger.previousElementSibling!.querySelector('span')!).right,
            })),
          };
        });
      const metrics = await readMetrics();
      expect(metrics.page).toBeLessThanOrEqual(metrics.viewport);
      for (const row of metrics.rows) {
        expect(row.gap).toBe('8px');
        for (const [index, owner] of row.owners.entries()) {
          expect(owner.separators).toHaveLength(index === 0 ? 0 : 1);
          for (const separator of owner.separators) {
            expect(separator.right).toBeLessThanOrEqual(owner.destination.left);
            expect(Math.abs(separator.center - owner.destination.center)).toBeLessThanOrEqual(1);
          }
          expect(owner.margin).toBe('0px');
          expect(owner.rect.left).toBeGreaterThanOrEqual(0);
          expect(owner.rect.right).toBeLessThanOrEqual(width);
          for (const part of owner.parts)
            expect(Math.abs(part.center - owner.rect.center)).toBeLessThanOrEqual(1);
        }
        for (const first of row.owners)
          for (const second of row.owners) {
            if (
              Math.min(first.rect.bottom, second.rect.bottom) -
                Math.max(first.rect.top, second.rect.top) >
              1
            )
              expect(Math.abs(first.rect.center - second.rect.center)).toBeLessThanOrEqual(1);
          }
      }
      for (const link of metrics.links) {
        expect(clippedControl(link)).toBe(false);
        expect(Number.isFinite(link.heightMinimum)).toBe(true);
        expect(link.heightMinimum).toBeGreaterThan(0);
        expect(Number.isFinite(link.widthMinimum)).toBe(true);
        expect(link.widthMinimum).toBeGreaterThan(0);
        expect(link.rect.height).toBeGreaterThanOrEqual(link.heightMinimum);
        expect(link.rect.left).toBeGreaterThanOrEqual(link.owner.left - 1);
        expect(link.rect.right).toBeLessThanOrEqual(link.owner.right + 1);
        expect(link.rect.top).toBeGreaterThanOrEqual(link.owner.top - 1);
        expect(link.rect.bottom).toBeLessThanOrEqual(link.owner.bottom + 1);
        if (link.iconOnly) expect(link.rect.width).toBeGreaterThanOrEqual(link.widthMinimum);
      }
      for (const label of metrics.labels) {
        expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
        expect(label.scrollHeight).toBeLessThanOrEqual(label.clientHeight + 1);
        for (const line of label.lines) {
          expect(line.left).toBeGreaterThanOrEqual(label.rect.left - 1);
          expect(line.right).toBeLessThanOrEqual(label.rect.right + 1);
          expect(line.top).toBeGreaterThanOrEqual(label.rect.top - 1);
          expect(line.bottom).toBeLessThanOrEqual(label.rect.bottom + 1);
          for (const bounds of [label.destination, label.owner]) {
            expect(line.left).toBeGreaterThanOrEqual(bounds.left - 1);
            expect(line.right).toBeLessThanOrEqual(bounds.right + 1);
            expect(line.top).toBeGreaterThanOrEqual(bounds.top - 1);
            expect(line.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
          }
          expect(line.left).toBeGreaterThanOrEqual(-1);
          expect(line.right).toBeLessThanOrEqual(width + 1);
          for (const clip of label.clips) {
            if (clip.x) {
              expect(line.left).toBeGreaterThanOrEqual(clip.rect.left - 1);
              expect(line.right).toBeLessThanOrEqual(clip.rect.right + 1);
            }
            if (clip.y) {
              expect(line.top).toBeGreaterThanOrEqual(clip.rect.top - 1);
              expect(line.bottom).toBeLessThanOrEqual(clip.rect.bottom + 1);
            }
          }
        }
      }
      if (syntheticLongLabels) {
        for (const text of [
          'Müşteri sözleşmeleri ve uyumluluk belgeleri çalışma alanı',
          'Customer onboarding documentation and approval history',
        ]) {
          const label = metrics.labels.find(label => label.text === text);
          expect(label).toBeDefined();
          if (width === 320) {
            expect(label!.lines.length).toBeGreaterThan(1);
            expect(label!.whiteSpace).not.toBe('nowrap');
          }
        }
      }
      for (const trigger of metrics.triggers) {
        expect(clippedControl(trigger)).toBe(false);
        expect(trigger.rect.left).toBeGreaterThanOrEqual(trigger.owner.left - 1);
        expect(trigger.rect.right).toBeLessThanOrEqual(trigger.owner.right + 1);
        expect(trigger.rect.top).toBeGreaterThanOrEqual(trigger.owner.top - 1);
        expect(trigger.rect.bottom).toBeLessThanOrEqual(trigger.owner.bottom + 1);
        expect(trigger.rect.left).toBeGreaterThanOrEqual(0);
        expect(trigger.rect.right).toBeLessThanOrEqual(width);
        expect(trigger.width).toBeGreaterThanOrEqual(56);
        expect(trigger.height).toBeGreaterThanOrEqual(56);
        expect(Math.abs(trigger.gap - 16)).toBeLessThanOrEqual(1);
      }
      if (syntheticLongLabels) {
        await catalog
          .locator('#breadcrumb-quick .genux-breadcrumb-part')
          .filter({ has: page.locator('.genux-breadcrumb-trigger') })
          .evaluate(part => {
            const label = part.querySelector<HTMLElement>('.genux-breadcrumb-link')!;
            label.style.flexShrink = '0';
            Object.assign((part as HTMLElement).style, {
              maxWidth: label.getBoundingClientRect().width + 'px',
              overflow: 'hidden',
              flexShrink: '0',
            });
          });
        const clipped = await readMetrics();
        expect(
          clipped.triggers.some(clippedControl),
          'same oracle must reject a clipped trigger with visible label',
        ).toBe(true);
      }
    }
  });
}
