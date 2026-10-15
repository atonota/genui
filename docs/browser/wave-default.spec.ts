import { expect, test } from '@playwright/test';

test('default Button wave peaks at 0.4 opacity over 400ms', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/components/button/');
  const button = page
    .locator('button.atlas-button.ant-btn-variant-solid:not(:disabled)')
    .filter({ hasText: 'Continue' })
    .first();
  await button.scrollIntoViewIfNeeded();
  // Settle pending scroll events (they clear waves), then watch for the real wave.
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    const w = window as unknown as { __wave: Promise<unknown> };
    w.__wave = new Promise((resolve, reject) => {
      const fail = (reason: string) => reject(new Error(`prerequisite: ${reason}`));
      const timer = setTimeout(() => fail('no .atlas-click-feedback emitted'), 5_000);
      const observer = new MutationObserver(async () => {
        const wave = document.querySelector<HTMLElement>('.atlas-click-feedback');
        if (!wave) return;
        observer.disconnect();
        clearTimeout(timer);
        const [animation] = wave.getAnimations();
        if (!animation?.effect) return fail('wave has no Web Animation');
        animation.pause();
        await animation.ready;
        const duration = Number(animation.effect.getComputedTiming().duration);
        animation.currentTime = duration * 0.15;
        if (!wave.isConnected) return fail('wave removed before sampling');
        const style = getComputedStyle(wave);
        resolve({
          opacity: Number(style.opacity),
          duration,
          cssDuration: style.animationDuration,
          easing: style.animationTimingFunction,
          progress: 0.15,
        });
      });
      observer.observe(document.body, { childList: true });
    });
  });
  await button.click();
  const sample = (await page.evaluate(
    () => (window as unknown as { __wave: Promise<unknown> }).__wave,
  )) as { opacity: number; duration: number };
  await testInfo.attach('wave-peak-sample', {
    body: JSON.stringify(sample, null, 2),
    contentType: 'application/json',
  });
  expect(sample.duration).toBe(400);
  expect(sample.opacity).toBeCloseTo(0.4, 2);
});
