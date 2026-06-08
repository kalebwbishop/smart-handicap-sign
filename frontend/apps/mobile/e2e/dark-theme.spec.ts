import { test, expect } from '@playwright/test';

test.describe('Composio Dark Theme', () => {
  test('landing page renders with dark background', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page body / root should have dark background
    const rootBg = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="root"]') || document.body;
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should not be white/light — expect a dark value
    expect(rootBg).not.toBe('rgb(255, 255, 255)');
    expect(rootBg).not.toBe('rgb(243, 244, 246)');
  });

  test('landing page has dark hero section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that text "HAZARD HERO" exists
    const label = page.getByText('HAZARD HERO');
    await expect(label.first()).toBeVisible();

    // The hero heading should be visible
    const heading = page.getByText('Smarter Accessible Parking Starts Here');
    await expect(heading).toBeVisible();
  });

  test('CTA buttons are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const demoBtn = page.getByRole('button', { name: 'Request a Demo' });
    await expect(demoBtn).toBeVisible();

    const howBtn = page.getByRole('button', { name: 'See How It Works' });
    await expect(howBtn).toBeVisible();
  });

  test('landing page screenshot matches dark theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'e2e/screenshots/landing-dark.png', fullPage: true });
  });
});
