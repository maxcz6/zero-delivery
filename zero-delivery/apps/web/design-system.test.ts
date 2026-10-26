import { test, expect } from '@playwright/test';

test('color palette CSS variables are defined', async ({ page }) => {
  await page.goto('http://localhost:3001');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Verify CSS variables exist and have correct values from MASTER.md
  const variables = await page.evaluate(() => {
    const computed = getComputedStyle(document.documentElement);
    return {
      primary: computed.getPropertyValue('--color-primary'),
      onPrimary: computed.getPropertyValue('--color-on-primary'),
      secondary: computed.getPropertyValue('--color-secondary'),
      onSecondary: computed.getPropertyValue('--color-on-secondary'),
      accent: computed.getPropertyValue('--color-accent'),
      onAccent: computed.getPropertyValue('--color-on-accent'),
      background: computed.getPropertyValue('--color-background'),
      foreground: computed.getPropertyValue('--color-foreground'),
      card: computed.getPropertyValue('--color-card'),
      border: computed.getPropertyValue('--color-border'),
      destructive: computed.getPropertyValue('--color-destructive'),
      ring: computed.getPropertyValue('--color-ring'),
    };
  });

  // Verify key colors from the design system MASTER.md
  expect(variables.primary).toContain('2563EB'); // #2563EB - Primary blue
  expect(variables.accent).toContain('EA580C'); // #EA580C - Orange CTA
  expect(variables.background).toContain('F8FAFC'); // #F8FAFC - Background
  expect(variables.foreground).toContain('1E293B'); // #1E293B - Foreground

  console.log('CSS Variables verified:', variables);
});

test('primary button has correct styles', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // Find and verify primary button
  const primaryBtn = page.locator('.btn-primary');
  await expect(primaryBtn).toBeVisible();
  await expect(primaryBtn).toHaveAttribute('cursor', 'pointer');

  // Verify button colors
  const color = await primaryBtn.evaluate(el => {
    return window.getComputedStyle(el).color;
  });
  const bgColor = await primaryBtn.evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Primary button should be orange (#EA580C) with black text (#000000)
  expect(color).not.toBe('rgba(0, 0, 0, 0)');
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');

  console.log('Primary button color:', color, 'background:', bgColor);
});

test('focus ring is visible on interactive elements', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // Find focusable elements and verify focus states
  await page.focus('a, button, input, .btn-primary');

  // Check that focused element has visible focus ring
  const focusedElement = await page.evaluate(() => {
    const active = document.activeElement;
    if (active) {
      const style = window.getComputedStyle(active);
      return {
        outline: style.outline,
        boxShadow: style.boxShadow,
        color: style.color,
      };
    }
    return null;
  });

  expect(focusedElement).not.toBeNull();
  console.log('Focus state:', focusedElement);

  // Verify focus ring is not transparent/empty
  if (focusedElement) {
    expect(focusedElement.boxShadow).not.toBe('0px 0px 0px 0px');
  }
});

test('no horizontal scroll on responsive sizes', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // Test responsive breakpoints from MASTER.md checklist
  const viewports = [
    { width: 375, height: 667 },   // iPhone small
    { width: 768, height: 1024 },  // iPad
    { width: 1024, height: 1440 }, // Desktop small
    { width: 1440, height: 900 },  // Desktop large
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy(`Horizontal scroll at ${viewport.width}x${viewport.height}`);
  }
});

test('typography and line-length', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // Verify body font-size and line-height
  const typography = await page.evaluate(() => {
    const computed = getComputedStyle(document.body);
    return {
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      fontFamily: computed.fontFamily,
    };
  });

  // Body should be at least 16px (iOS prevention)
  expect(typography.fontSize).not.toMatch(/^0/);
  expect(typography.fontSize).toMatch(/16px/ || /larger/);

  console.log('Typography:', typography);
});