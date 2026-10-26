# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: design-system.test.ts >> typography and line-length
- Location: design-system.test.ts:114:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
Call log:
  - navigating to "http://localhost:3001/", waiting until "load"

```

# Test source

```ts
  15  |       secondary: computed.getPropertyValue('--color-secondary'),
  16  |       onSecondary: computed.getPropertyValue('--color-on-secondary'),
  17  |       accent: computed.getPropertyValue('--color-accent'),
  18  |       onAccent: computed.getPropertyValue('--color-on-accent'),
  19  |       background: computed.getPropertyValue('--color-background'),
  20  |       foreground: computed.getPropertyValue('--color-foreground'),
  21  |       card: computed.getPropertyValue('--color-card'),
  22  |       border: computed.getPropertyValue('--color-border'),
  23  |       destructive: computed.getPropertyValue('--color-destructive'),
  24  |       ring: computed.getPropertyValue('--color-ring'),
  25  |     };
  26  |   });
  27  | 
  28  |   // Verify key colors from the design system MASTER.md
  29  |   expect(variables.primary).toContain('2563EB'); // #2563EB - Primary blue
  30  |   expect(variables.accent).toContain('EA580C'); // #EA580C - Orange CTA
  31  |   expect(variables.background).toContain('F8FAFC'); // #F8FAFC - Background
  32  |   expect(variables.foreground).toContain('1E293B'); // #1E293B - Foreground
  33  | 
  34  |   console.log('CSS Variables verified:', variables);
  35  | });
  36  | 
  37  | test('primary button has correct styles', async ({ page }) => {
  38  |   await page.goto('http://localhost:3001');
  39  |   await page.waitForLoadState('networkidle');
  40  | 
  41  |   // Find and verify primary button
  42  |   const primaryBtn = page.locator('.btn-primary');
  43  |   await expect(primaryBtn).toBeVisible();
  44  |   await expect(primaryBtn).toHaveAttribute('cursor', 'pointer');
  45  | 
  46  |   // Verify button colors
  47  |   const color = await primaryBtn.evaluate(el => {
  48  |     return window.getComputedStyle(el).color;
  49  |   });
  50  |   const bgColor = await primaryBtn.evaluate(el => {
  51  |     return window.getComputedStyle(el).backgroundColor;
  52  |   });
  53  | 
  54  |   // Primary button should be orange (#EA580C) with black text (#000000)
  55  |   expect(color).not.toBe('rgba(0, 0, 0, 0)');
  56  |   expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  57  | 
  58  |   console.log('Primary button color:', color, 'background:', bgColor);
  59  | });
  60  | 
  61  | test('focus ring is visible on interactive elements', async ({ page }) => {
  62  |   await page.goto('http://localhost:3001');
  63  |   await page.waitForLoadState('networkidle');
  64  | 
  65  |   // Find focusable elements and verify focus states
  66  |   await page.focus('a, button, input, .btn-primary');
  67  | 
  68  |   // Check that focused element has visible focus ring
  69  |   const focusedElement = await page.evaluate(() => {
  70  |     const active = document.activeElement;
  71  |     if (active) {
  72  |       const style = window.getComputedStyle(active);
  73  |       return {
  74  |         outline: style.outline,
  75  |         boxShadow: style.boxShadow,
  76  |         color: style.color,
  77  |       };
  78  |     }
  79  |     return null;
  80  |   });
  81  | 
  82  |   expect(focusedElement).not.toBeNull();
  83  |   console.log('Focus state:', focusedElement);
  84  | 
  85  |   // Verify focus ring is not transparent/empty
  86  |   if (focusedElement) {
  87  |     expect(focusedElement.boxShadow).not.toBe('0px 0px 0px 0px');
  88  |   }
  89  | });
  90  | 
  91  | test('no horizontal scroll on responsive sizes', async ({ page }) => {
  92  |   await page.goto('http://localhost:3001');
  93  |   await page.waitForLoadState('networkidle');
  94  | 
  95  |   // Test responsive breakpoints from MASTER.md checklist
  96  |   const viewports = [
  97  |     { width: 375, height: 667 },   // iPhone small
  98  |     { width: 768, height: 1024 },  // iPad
  99  |     { width: 1024, height: 1440 }, // Desktop small
  100 |     { width: 1440, height: 900 },  // Desktop large
  101 |   ];
  102 | 
  103 |   for (const viewport of viewports) {
  104 |     await page.setViewportSize(viewport);
  105 | 
  106 |     const hasHorizontalScroll = await page.evaluate(() => {
  107 |       return document.documentElement.scrollWidth > window.innerWidth;
  108 |     });
  109 | 
  110 |     expect(hasHorizontalScroll).toBeFalsy(`Horizontal scroll at ${viewport.width}x${viewport.height}`);
  111 |   }
  112 | });
  113 | 
  114 | test('typography and line-length', async ({ page }) => {
> 115 |   await page.goto('http://localhost:3001');
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
  116 |   await page.waitForLoadState('networkidle');
  117 | 
  118 |   // Verify body font-size and line-height
  119 |   const typography = await page.evaluate(() => {
  120 |     const computed = getComputedStyle(document.body);
  121 |     return {
  122 |       fontSize: computed.fontSize,
  123 |       lineHeight: computed.lineHeight,
  124 |       fontFamily: computed.fontFamily,
  125 |     };
  126 |   });
  127 | 
  128 |   // Body should be at least 16px (iOS prevention)
  129 |   expect(typography.fontSize).not.toMatch(/^0/);
  130 |   expect(typography.fontSize).toMatch(/16px/ || /larger/);
  131 | 
  132 |   console.log('Typography:', typography);
  133 | });
```