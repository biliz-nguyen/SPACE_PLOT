import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});
const project = (page) =>
  page.evaluate(async () =>
    structuredClone((await import("/src/store.js")).store.project),
  );

test("catalog keyboard search, add, inspector position and persistence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#instance-count")).toHaveText("18 PARTS");
  await page.keyboard.press("/");
  await expect(page.locator("#catalog-search")).toBeFocused();
  await page.locator("#catalog-search").fill("battery");
  await expect(page.locator("[data-add]")).toHaveCount(1);
  await page.locator("[data-add]").click();
  await expect(page.locator("#placement-review-card")).toBeVisible();
  await page.locator("#accept-placement-btn").click();
  await expect(page.locator("#instance-count")).toHaveText("19 PARTS");
  await expect(page.locator("#selected-content")).toContainText("LiPo");
  await page.locator('[data-pos="0"]').fill("37");
  await expect(page.locator('[data-pos="0"]')).toHaveValue("37");
  const saved = await project(page);
  await page.reload();
  expect(await project(page)).toEqual(saved);
  await page.locator(`[data-select="${saved.instances.at(-1).id}"]`).click();
  await expect(page.locator('[data-pos="0"]')).toHaveValue("37");
  await page.locator("#delete-selected").click();
  await expect(page.locator("#instance-count")).toHaveText("18 PARTS");
});

test("exploded view is visual only and wiring remains editable", async ({
  page,
}) => {
  await page.goto("/");
  const original = await project(page);
  await page.locator("#explode-slider").fill("75");
  await expect(page.locator("#explode-value")).toHaveText("75%");
  expect(await project(page)).toEqual(original);
  await page.locator("#show-clearance").check();
  await page.locator("#show-labels").uncheck();
  expect(await project(page)).toEqual(original);
  await page.locator('[data-mode="wiring"]').click();
  await expect(page.locator("#explode-value")).toHaveText("0%");
  await expect(
    page.getByRole("tab", { name: "Wiring", exact: true }),
  ).toHaveAttribute("data-state", "active");
  const before = original.connections.length;
  await page.locator("#add-wire-btn").click();
  await expect(page.locator(".wire-row")).toHaveCount(before + 1);
  await page.locator("[data-remove-wire]").last().click();
  await expect(page.locator(".wire-row")).toHaveCount(before);
  await page.getByRole("tab", { name: /Checks/ }).click();
  await expect(page.locator("#diagnostics")).toContainText(/demo/i);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#report-btn").click();
  const download = await downloadPromise;
  const report = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(report.projectName).toBe(original.projectName);
  expect(report.validation.summary).toHaveProperty("fail");
});

test("project JSON round-trip keeps schema and rejects broken imports", async ({
  page,
}) => {
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-btn").click();
  const downloaded = await downloadPromise,
    exported = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  expect(exported).toEqual(await project(page));
  exported.projectName = "Expedition 002 / Việt Nam";
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "project.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await expect(page.locator("#project-name")).toHaveValue(exported.projectName);
  expect(await project(page)).toEqual(exported);
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"instances":"broken"}'),
    });
  await expect(
    page.getByRole("status").filter({ hasText: "Import failed" }),
  ).toBeVisible();
  expect(await project(page)).toEqual(exported);
  await page.reload();
  await expect(page.locator("#project-name")).toHaveValue(exported.projectName);
});

test("settings and reset dialogs trap focus, support Escape and preserve canceled work", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Workspace settings" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Connection & storage" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  const before = await project(page);
  await page.locator("#reset-btn").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await project(page)).toEqual(before);
});

test("local-only Community and AI give clear connection states", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      async () => (await import("/src/assets/cloud.js")).cloudConfiguration,
    ),
  ).toBe("local");
  await page.locator("#open-community").click();
  await expect(page.locator("#cloud-auth")).toContainText(
    "Community is not connected yet",
  );
  await expect(page.locator("#send-request")).toBeDisabled();
  await page.locator('[data-tab="ai"]').first().click();
  await expect(page.locator("#ai-generate")).toBeDisabled();
  await expect(page.locator("#ai-status")).toContainText(
    "Connect cloud services",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#asset-studio")).not.toBeVisible();
  await page.locator("#open-hangar").click();
  await expect(page.locator("#tab-local")).toBeVisible();
});

test("responsive panels and accessibility at desktop, tablet, mobile and import", async ({
  page,
}) => {
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.goto("/");
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 390) {
      await page
        .getByRole("button", { name: "Parts catalog", exact: true })
        .click();
      await expect(page.locator("#parts-panel")).toBeVisible();
      await page.locator("#catalog-search").fill("gps");
      await expect(page.locator("[data-add]")).toHaveCount(1);
      await page.getByRole("button", { name: "Đóng parts catalog" }).click();
      await page
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      await expect(page.locator("#inspector-panel")).toBeVisible();
      await page.getByRole("button", { name: "Đóng inspector" }).click();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact),
      ),
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  }
  await page.locator("#import-btn").click();
  await expect(page.locator("#asset-studio")).toHaveCSS("opacity", "1");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    ),
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
  await page.screenshot({
    path: "artifacts/screenshots/premium-mobile-import.png",
    fullPage: true,
  });
});

test("without WebGL the local project and import tools remain available", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.includes("webgl") ? null : original.call(this, kind, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#viewport-error")).toContainText(
    "3D preview unavailable",
  );
  await expect(page.locator("#import-btn")).toBeEnabled();
  await expect(page.locator("#mass-value")).toContainText("1,162");
  await page.locator("#import-btn").click();
  await expect(page.locator("#asset-studio")).toBeVisible();
  expect(errors).toEqual([]);
});

test("canvas selection and Move tool change XY while preserving height", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#three-container canvas")).toHaveCount(1);
  await page.locator("#camera-home").click();
  await page.locator('[data-tool="move"]').click();
  const before = await project(page);
  console.log("MOTOR-1:", before.instances.find((i) => i.id === "motor-1"));
  const point = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { store } = await import("/src/store.js"),
      { mmToWorld } = await import("/src/scene.js");
    const rect = document
        .querySelector("#three-container canvas")
        .getBoundingClientRect(),
      factor = rect.width / rect.height > 1.6 ? 0.72 : 1;
    const camera = new THREE.PerspectiveCamera(
      42,
      rect.width / rect.height,
      0.01,
      250,
    );
    camera.position.set(5.7 * factor, 4.8 * factor, 6.4 * factor);
    camera.lookAt(0, 0.15, 0);
    camera.updateMatrixWorld();
    const motor = store.project.instances.find((i) => i.id === "motor-1");
    const position = mmToWorld(motor.positionMm);
    position.y -= 0.03;
    position.project(camera);
    return {
      x: rect.x + ((position.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - position.y) * rect.height) / 2,
    };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 45, point.y + 25, { steps: 8 });
  await page.mouse.up();
  const after = await project(page),
    changed = after.instances.filter(
      (part, index) =>
        JSON.stringify(part.positionMm) !==
        JSON.stringify(before.instances[index].positionMm),
    );
  expect(changed).toHaveLength(1);
  expect(changed[0].positionMm[2]).toBe(
    before.instances.find((part) => part.id === changed[0].id).positionMm[2],
  );
  await expect(page.locator("#selected-content")).not.toContainText(
    "Select a component",
  );
});

test("drag and drop catalog part into 3D view, review coordinates, and accept", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#instance-count")).toHaveText("18 PARTS");

  // Filter or search to reveal part
  await page.locator("#catalog-search").fill("gps");
  const partCard = page.locator('.part-card[data-add="gps-uart"]');
  await expect(partCard).toBeVisible();

  // Drag part from catalog onto 3D viewport
  const viewport = page.locator("#three-container");
  await partCard.dragTo(viewport);

  // Review card should be visible
  await expect(page.locator("#placement-review-card")).toBeVisible();
  await expect(page.locator("#placement-review-card")).toContainText("UART GPS");

  // User enters custom coordinate values
  await page.locator("#review-pos-x").fill("120");
  await page.locator("#review-pos-y").fill("-65");
  await page.locator("#review-pos-z").fill("45");

  // Accept placement
  await page.locator("#accept-placement-btn").click();
  await expect(page.locator("#placement-review-card")).not.toBeVisible();

  // Part should be added with the exact reviewed coordinates
  await expect(page.locator("#instance-count")).toHaveText("19 PARTS");
  const p = await project(page);
  const lastInstance = p.instances.at(-1);
  expect(lastInstance.componentId).toBe("gps-uart");
  expect(lastInstance.positionMm).toEqual([120, -65, 45]);
});

test("review placement cancel discards the preview without modifying assembly", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#instance-count")).toHaveText("18 PARTS");

  // Filter to reveal receiver
  await page.locator("#catalog-search").fill("receiver");
  const partCard = page.locator('.part-card[data-add="rx-uart"]');
  await expect(partCard).toBeVisible();
  await partCard.click();

  await expect(page.locator("#placement-review-card")).toBeVisible();
  await expect(page.locator("#placement-review-card")).toContainText("Serial Receiver");

  // Cancel placement
  await page.locator("#cancel-placement-btn").click();
  await expect(page.locator("#placement-review-card")).not.toBeVisible();

  // Instance count remains unchanged
  await expect(page.locator("#instance-count")).toHaveText("18 PARTS");
});

test("review placement panel can be dragged freely across the screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#catalog-search").fill("gps");
  const partCard = page.locator('.part-card[data-add="gps-uart"]');
  await partCard.click();

  const reviewCard = page.locator("#placement-review-card");
  await expect(reviewCard).toBeVisible();

  const initialBox = await reviewCard.boundingBox();
  expect(initialBox).toBeTruthy();

  // Drag the review card by its drag handle bar
  const dragBar = page.locator(".review-drag-handle-bar");
  const dragBox = await dragBar.boundingBox();
  expect(dragBox).toBeTruthy();

  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x - 120, dragBox.y - 180, { steps: 10 });
  await page.mouse.up();

  const newBox = await reviewCard.boundingBox();
  expect(newBox.x).toBeLessThan(initialBox.x);
  expect(newBox.y).toBeLessThan(initialBox.y);

  // Test collapse and expand toggle
  await page.locator(".review-icon-btn").click();
  await expect(page.locator(".review-coords-section")).not.toBeVisible();
  await page.locator(".review-icon-btn").click();
  await expect(page.locator(".review-coords-section")).toBeVisible();
});
