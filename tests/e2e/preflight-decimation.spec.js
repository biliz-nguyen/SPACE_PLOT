import { test, expect } from '@playwright/test';

test('auto-preflight telemetry analysis and sharp CAD decimation workflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#import-btn').click();

  // 1. Select file - should automatically analyze without needing to click process
  await page.locator('#asset-files').setInputFiles('tests/fixtures/bracket.stl');

  // Verify stage item appears
  const stageItem = page.locator('.stage-item');
  await expect(stageItem).toHaveCount(1, { timeout: 15000 });
  await expect(stageItem).toContainText('bracket');

  // 2. Verify Pre-flight Telemetry Panel
  const preflight = page.locator('#preflight-analysis');
  await expect(preflight).toBeVisible();
  await expect(preflight).toContainText('PRE-FLIGHT TELEMETRY');
  await expect(preflight).toContainText('STL');
  await expect(preflight).toContainText('BOUNDING BOX');
  await expect(preflight).toContainText('336'); // triangle count

  // 3. Verify Sharp Decimation Panel
  const decimation = page.locator('#decimation-toolbar');
  await expect(decimation).toBeVisible();
  await expect(decimation).toContainText('GIẢM TAM GIÁC GIỮ CẠNH SẮC');
  await expect(decimation).toContainText('CAD 32° Crease');

  // Take screenshot of initial analysis
  await page.screenshot({ path: 'test-results/preflight-analysis-initial.png' });

  // 4. Click Decimate button
  const btnDecimate = page.locator('#btn-run-decimate');
  await btnDecimate.click();

  // Wait for decimation to finish and verify reduced count
  await expect(page.locator('.badge-success')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.badge-success')).toContainText('Đã tối ưu');

  // Stage item and telemetry should show lower triangle count
  await expect(stageItem).not.toContainText('336 triangles');

  // Take screenshot of decimated result
  await page.screenshot({ path: 'test-results/preflight-decimated-sharp.png' });

  // 5. Test Undo / Revert to original
  const btnUndo = page.locator('#btn-undo-decimate');
  await expect(btnUndo).toBeEnabled();
  await btnUndo.click();

  // Should restore back to 336 triangles
  await expect(stageItem).toContainText('336 triangles');
  await expect(preflight).toContainText('336');

  expect(errors).toEqual([]);
});
