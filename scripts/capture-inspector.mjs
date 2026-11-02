import { chromium } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://127.0.0.1:5173/");
await page.locator("#scene-status").filter({ hasText: "parts" }).waitFor();
await page.waitForTimeout(600);

// Close taskbar if open
const taskbar = page.locator("#cyber-taskbar");
if (await taskbar.isVisible()) {
  await page.locator(".actions-toggle-handle").click();
  await page.waitForTimeout(300);
}

await mkdir("artifacts/screenshots", { recursive: true });

// 1. Open Inspector view
await page.screenshot({ path: "artifacts/screenshots/inspector-open.png" });

// 2. Collapse Inspector view
await page.locator(".desktop-panel-toggle.right").click({ force: true });
await page.waitForTimeout(400);
await page.screenshot({ path: "artifacts/screenshots/inspector-collapsed.png" });

// 3. Re-open Inspector view
await page.locator(".floating-dock-pill.right").click({ force: true });
await page.waitForTimeout(400);

// 4. Resize Inspector (drag handle to the left to make it wider)
const handle = page.locator(".panel-resize-handle.right");
const box = await handle.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/screenshots/inspector-resized.png" });
}

await browser.close();

// Copy to brain artifact directory
const brainDir = "/home/minh/.gemini/antigravity/brain/21e632d3-e777-4a43-9f30-a375a33cb363";
try {
  await copyFile("artifacts/screenshots/inspector-open.png", `${brainDir}/inspector-open.png`);
  await copyFile("artifacts/screenshots/inspector-collapsed.png", `${brainDir}/inspector-collapsed.png`);
  await copyFile("artifacts/screenshots/inspector-resized.png", `${brainDir}/inspector-resized.png`);
  console.log("Successfully copied screenshots to brain dir!");
} catch (e) {
  console.error("Copy error:", e);
}
