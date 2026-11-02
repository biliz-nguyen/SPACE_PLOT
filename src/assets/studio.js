import { validateFiles, CAD, extension, validateMetadata } from "./policy.js";
import { parseModel, releaseObject } from "./importer.js";
import { allAssets, saveAsset, getAsset } from "./db.js";
import { generateUUID } from "./crypto.js";
import { AssetPreview } from "./preview.js";
import {
  cloud,
  requireUser,
  invoke,
  approved,
  pending,
  downloadCloud,
  modelRequests,
} from "./cloud.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dims = (a) =>
  a.dimensionsMm
    .map((n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }))
    .join(" × ");
const bytes = (n) => (n / 1024 / 1024).toFixed(2) + " MiB";
export function setupStudio({ store, catalog, model, toast }) {
  let assets = [],
    staged = [],
    files = [],
    busy = false,
    selected = null,
    remote = [],
    queue = [],
    user = null,
    tab = "import",
    job = null,
    pollTimer = null;
  const controller = new AbortController(),
    signal = controller.signal;
  const dialog = document.createElement("dialog");
  dialog.id = "asset-studio";
  dialog.className = "studio";
  dialog.setAttribute("aria-label", "Asset Operations");
  dialog.innerHTML = `<div class="studio-head"><div><div class="eyebrow">SPACE_PLOT / ASSET OPERATIONS</div><h2>Build your next expedition.</h2></div><button class="icon-button" id="studio-close" aria-label="Đóng asset studio">×</button></div>
 <nav class="studio-tabs" aria-label="Asset studio"><button data-tab="import" class="active">01 <span>Import model</span></button><button data-tab="local">02 <span>My hangar</span></button><button data-tab="ai">03 <span>AI workshop</span></button><button data-tab="community">04 <span>Community</span></button></nav>
 <div class="studio-body"><section id="tab-import" class="studio-tab"><ol class="import-progress" aria-label="Import progress"><li aria-current="step">Select files</li><li>Inspect &amp; confirm scale</li><li>Save to hangar</li></ol><div class="studio-columns"><div><div class="eyebrow">A CONTROLLED LANDING</div><h3>From file to flight deck.</h3><p class="muted">Chọn file → xử lý hình học → kiểm tra → lưu vào My hangar. Bạn quyết định lúc thêm vào scene.</p>
 <label class="drop-zone" id="file-drop"><span class="upload-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></span><strong>Thả model và file đi kèm vào đây</strong><span>hoặc bấm để chọn nhiều file</span><small>GLB · glTF · OBJ + MTL · STL · PLY<br>STEP / STP · IGES / IGS · BREP</small><input id="asset-files" type="file" multiple accept=".glb,.gltf,.bin,.obj,.mtl,.stl,.ply,.step,.stp,.iges,.igs,.brep,.png,.jpg,.jpeg,.webp" /></label>
 <div class="import-settings"><label>Đơn vị nguồn <select id="source-unit"><option value="mm">Millimeter · mm</option><option value="cm">Centimeter · cm</option><option value="m">Meter · m</option><option value="in">Inch · in</option></select></label><label>Trục đứng nguồn <select id="source-up"><option value="z">Z-up · CAD</option><option value="y">Y-up</option></select></label></div>
 <p class="micro">GLB/glTF luôn đọc m + Y-up theo chuẩn. STEP/IGES tự chuyển về mm. Chọn đơn vị cho OBJ/STL/PLY/BREP. Không co model để ép vừa linh kiện.</p><div id="file-summary" class="file-summary">Chưa chọn file · tối đa 40 MiB / 32 file</div>
 <button id="process-files" class="btn primary full" disabled>Process & inspect →</button><div id="import-log" class="import-log" role="status" aria-live="polite"></div>
 </div><div class="preview-column"><div class="preview-box" id="asset-preview"><div class="preview-placeholder" id="preview-placeholder">MODEL PREVIEW<br><small>Geometry first. No guesswork.</small></div></div><div id="staged-list"></div><label class="check review-check"><input type="checkbox" id="confirm-import" /> Tôi đã kiểm tra đơn vị, trục và kích thước hiển thị.</label><button id="save-import" class="btn primary full" disabled>Save to my hangar</button></div></div></section>
 <section id="tab-local" class="studio-tab" hidden><div class="tab-intro"><div><div class="eyebrow">YOUR PRIVATE COLLECTION</div><h3>My hangar</h3><p class="muted">Lưu trên trình duyệt này. Kéo vào scene hoặc bấm Add. Export GLB để có bản sao.</p></div><button class="btn secondary" data-tab="import">+ Import model</button></div><div id="local-assets"></div><div id="contribute-form"></div></section>
 <section id="tab-ai" class="studio-tab" hidden><div class="studio-columns"><div><div class="eyebrow">GENERATIVE WORKSHOP</div><h3>Give an idea its shape.</h3><p class="muted">Meshy Text-to-3D tạo mesh trực quan. CAD có sẵn được tessellate trực tiếp để giữ hình học; AI không thay thế thông số kỹ thuật.</p><label>Provider<select disabled><option>Meshy · Text to 3D preview</option></select></label><label>Mô tả model<textarea id="ai-prompt" maxlength="600" rows="5" placeholder="A compact quadcopter GPS module, separate component, neutral material, no text…"></textarea></label><label>Cạnh dài nhất ước lượng (mm)<input id="ai-size" type="number" value="50" min="0.01" max="10000" /></label><label class="check review-check"><input id="ai-consent" type="checkbox" /> Tạo task dùng credit của provider, tối đa 3 lượt/ngày.</label><button class="btn primary full" id="ai-generate">Generate preview →</button><p class="micro">API key chỉ nằm trên server. Cần đăng nhập. Provider khác có thể bổ sung bằng adapter; hiện chỉ Meshy được tích hợp.</p><div id="ai-status" role="status" class="import-log">Chưa tạo task.</div><button class="btn secondary full" id="ai-resume" hidden>Kiểm tra task gần nhất</button><button class="btn primary full" id="ai-download" hidden>Import generated GLB for review</button></div><div class="ai-explainer"><div class="orbit-mark">◌</div><span class="eyebrow">VISUAL EXPLORATION</span><h3>Imagine. Generate.<br>Inspect. Assemble.</h3><p>Model AI được gắn nhãn <strong>AI VISUAL</strong>. Kích thước đặt thủ công và các thông số chưa có nguồn xác thực sẽ luôn được đánh dấu chưa xác minh.</p><div class="workflow-mini"><span>Prompt</span><span>Meshy task</span><span>GLB validation</span><span>My hangar</span></div></div></div></section>
 <section id="tab-community" class="studio-tab" hidden><div class="tab-intro"><div><div class="eyebrow">BUILT TO SHARE / CURATED BY OWNER</div><h3>Community vault</h3><p class="muted">Chỉ GLB đã được chủ kho duyệt mới xuất hiện công khai. Duyệt model không có nghĩa là xác nhận an toàn phần cứng.</p></div><button id="refresh-community" class="btn secondary">↻ Refresh</button></div><div id="cloud-auth"></div><div class="request-box"><input id="request-title" maxlength="100" placeholder="Tên linh kiện bạn muốn có…" aria-label="Tên model yêu cầu" /><input id="request-details" maxlength="4000" placeholder="Thông số, nguồn tham khảo, mục đích…" aria-label="Chi tiết yêu cầu model" /><button id="send-request" class="btn secondary">Request a model</button></div><div id="community-assets"></div><div id="review-queue"></div><div id="model-requests"></div></section>
 </div><div class="studio-footer"><span id="studio-status" role="status" aria-live="polite">LOCAL FIRST · NO AUTOMATIC UPLOAD</span><span>GLB CANONICAL / METERS / Y-UP</span></div>`;
  document.body.append(dialog);
  const $ = (s) => dialog.querySelector(s),
    preview = new AssetPreview($("#asset-preview"));
  const status = (s) => ($("#studio-status").textContent = s);
  const progress = (step) =>
    dialog.querySelectorAll(".import-progress li").forEach((el, i) => {
      if (i === step) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
  function switchTab(next) {
    tab = next;
    dialog
      .querySelectorAll(".studio-tab")
      .forEach((s) => (s.hidden = s.id !== "tab-" + next));
    dialog.querySelectorAll(".studio-tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === next);
      b.setAttribute("aria-current", b.dataset.tab === next ? "page" : "false");
    });
    if (next === "local") refreshLocal();
    if (next === "community") refreshCommunity();
    if (next === "ai") restoreJob();
  }
  function open(next = "import") {
    if (!dialog.open) dialog.showModal();
    switchTab(next);
  }
  $("#studio-close").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    clearTimeout(pollTimer);
  });
  dialog.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) switchTab(t.dataset.tab);
  });
  const locked = (state) => {
    busy = state;
    for (const s of [
      "#asset-files",
      "#source-unit",
      "#source-up",
      "#process-files",
    ])
      $(s).disabled = state;
    $("#process-files").disabled = state || !files.length;
  };
  function choose(list) {
    if (busy) return;
    try {
      const next = Array.from(list);
      validateFiles(next);
      files = next;
      $("#file-summary").textContent = files.map((f) => f.name).join(" · ");
      $("#process-files").disabled = false;
      status("FILES SELECTED · READY TO PROCESS");
    } catch (e) {
      status(e.message);
    }
  }
  $("#asset-files").onchange = (e) => choose(e.target.files);
  const zone = $("#file-drop");
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  };
  zone.ondragleave = () => zone.classList.remove("drag-over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    choose(e.dataTransfer.files);
  };
  function selectStage(index) {
    selected = staged[index];
    if (!selected) return;
    preview.show(selected.object);
    $("#preview-placeholder").hidden = true;
    dialog
      .querySelectorAll("[data-stage]")
      .forEach((b) =>
        b.classList.toggle("active", Number(b.dataset.stage) === index),
      );
  }
  function showStages() {
    $("#staged-list").innerHTML = staged
      .map(
        (s, i) =>
          `<button class="stage-item" data-stage="${i}"><span>◈</span><div><strong>${esc(s.asset.name)}</strong><small>${dims(s.asset)} mm · ${s.asset.triangles.toLocaleString()} triangles · ${bytes(s.asset.bytes)}</small>${s.warnings.map((w) => `<small class="amber-text">${esc(w)}</small>`).join("")}</div><span>✓</span></button>`,
      )
      .join("");
    $("#confirm-import").checked = false;
    $("#save-import").disabled = true;
    progress(staged.length ? 1 : 0);
    if (staged.length) selectStage(0);
  }
  $("#staged-list").onclick = (e) => {
    const b = e.target.closest("[data-stage]");
    if (b) selectStage(Number(b.dataset.stage));
  };
  $("#process-files").onclick = async () => {
    if (busy) return;
    locked(true);
    preview.clear();
    staged.forEach((s) => releaseObject(s.object));
    staged = [];
    $("#staged-list").replaceChildren();
    $("#confirm-import").checked = false;
    $("#save-import").disabled = true;
    const logs = [];
    try {
      const models = validateFiles(files);
      for (const file of models) {
        status("PROCESSING " + file.name);
        $("#import-log").textContent = "Đang xử lý " + file.name + "…";
        await new Promise((r) => setTimeout(r, 0));
        try {
          staged.push(
            await parseModel(file, files, {
              unit: $("#source-unit").value,
              up: $("#source-up").value,
            }),
          );
          logs.push("✓ " + file.name);
        } catch (e) {
          logs.push("✕ " + file.name + ": " + e.message);
        }
      }
      showStages();
      status(`${staged.length} MODEL READY · VERIFY DIMENSIONS BEFORE SAVING`);
    } catch (e) {
      logs.push(e.message);
    } finally {
      $("#import-log").textContent = logs.join("\n");
      locked(false);
    }
  };
  $("#confirm-import").onchange = (e) =>
    ($("#save-import").disabled = !e.target.checked || !staged.length || busy);
  $("#save-import").onclick = async () => {
    if (!$("#confirm-import").checked || busy) return;
    busy = true;
    $("#save-import").disabled = true;
    preview.clear();
    try {
      for (const s of [...staged]) {
        await saveAsset(s.asset);
        store.registerAsset(s.asset);
        releaseObject(s.object);
        staged = staged.filter((x) => x !== s);
      }
      preview.clear();
      selected = null;
      await refreshLocal();
      switchTab("local");
      status("SAVED LOCALLY · DRAG INTO THE SCENE");
      toast("Đã lưu GLB vào My hangar.");
    } catch (e) {
      status("Không thể lưu: " + e.message);
    } finally {
      busy = false;
      showStages();
    }
  };
  function table(list, kind) {
    return `<div class="table-scroll"><table class="asset-table"><caption>${kind === "local" ? "Local assets" : kind === "queue" ? "Requests awaiting review" : "Verified community models"} · ${list.length}</caption><thead><tr><th scope="col">MODEL / SOURCE</th><th scope="col">DIMENSIONS (mm)</th><th scope="col">MESH</th><th scope="col">STATUS</th><th scope="col">ACTION</th></tr></thead><tbody>${list.map((a) => `<tr draggable="${kind === "local"}" data-drag-asset="${a.id}"><td><strong>${esc(a.name || a.title)}</strong><small>${esc(a.sourceFormat || a.provenance?.sourceFormat || "glb")} · ${esc(a.origin || a.provenance?.origin || "contributed")}</small></td><td class="numeric">${dims({ dimensionsMm: a.dimensionsMm || a.dimensions_mm })}<small>${a.massG ?? a.mass_g ?? "—"} g · unverified specs</small></td><td class="numeric">${a.triangles.toLocaleString()}<small>${bytes(a.bytes)}</small></td><td><span class="pill ${a.status === "approved" ? "success" : ""}">${esc(a.status === "approved" ? "OWNER REVIEWED" : a.origin === "ai" ? "AI VISUAL" : a.status || "LOCAL")}</span></td><td class="row-actions">${kind === "local" ? `<button class="text-button" data-insert="${a.id}">Add ↗</button><button class="text-button" data-export-asset="${a.id}">GLB ↓</button><button class="text-button" data-contribute="${a.id}">Contribute</button>` : kind === "queue" ? `<button class="text-button" data-preview-cloud="${a.id}">Inspect</button>${user?.app_metadata?.role === "space_lot_admin" ? `<button class="text-button" data-review-form="${a.id}">Review</button>` : ""}` : `<button class="text-button" data-download-cloud="${a.id}">Import ↗</button>`}</td></tr>`).join("") || '<tr><td colspan="5" class="table-empty">Chưa có model. Import file của bạn để bắt đầu.</td></tr>'}</tbody></table></div>`;
  }
  async function refreshLocal() {
    try {
      assets = await allAssets();
      $("#local-assets").innerHTML = table(assets, "local");
      renderShelf();
    } catch (e) {
      status("Không đọc được bộ nhớ model: " + e.message);
    }
  }
  function renderShelf() {
    const el = document.getElementById("asset-shelf");
    if (!el) return;
    el.innerHTML = assets.length
      ? assets
          .map(
            (a) =>
              `<div class="hangar-item" draggable="true" data-drag-asset="${a.id}"><span class="hangar-icon">◈</span><div><strong>${esc(a.name)}</strong><small>${esc(a.sourceFormat.toUpperCase())} · ${a.triangles.toLocaleString()} tris</small></div><button data-shelf-add="${a.id}" aria-label="Thêm ${esc(a.name)}" title="Thêm vào scene">+</button></div>`,
          )
          .join("")
      : '<button class="hangar-empty" id="shelf-import">↥ Import your first model<span>CAD, GLB, OBJ and more</span></button>';
  }
  async function insert(id, event) {
    try {
      const asset = await getAsset(id);
      if (!asset) throw Error("Thiếu file cục bộ.");
      store.registerAsset(asset);
      const position = event ? model.dropPosition(event) : null;
      const inst = store.add("asset-" + id);
      if (!inst) throw Error("Scene đạt giới hạn 80 linh kiện.");
      if (position) store.move(inst.id, position);
      toast("Đã thêm " + asset.name);
      return inst;
    } catch (e) {
      toast(e.message);
    }
  }
  document.addEventListener(
    "dragstart",
    (e) => {
      const item = e.target.closest("[data-drag-asset]");
      if (item) {
        e.dataTransfer.setData(
          "application/x-space-lot-asset",
          item.dataset.dragAsset,
        );
        e.dataTransfer.effectAllowed = "copy";
      }
    },
    { signal },
  );
  const viewport = document.getElementById("three-container");
  viewport.addEventListener(
    "dragover",
    (e) => {
      if (e.dataTransfer.types.includes("application/x-space-lot-asset")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        viewport.classList.add("drop-target");
      }
    },
    { signal },
  );
  viewport.addEventListener(
    "dragleave",
    () => viewport.classList.remove("drop-target"),
    { signal },
  );
  viewport.addEventListener(
    "drop",
    (e) => {
      const id = e.dataTransfer.getData("application/x-space-lot-asset");
      if (id) {
        e.preventDefault();
        viewport.classList.remove("drop-target");
        insert(id, e);
      }
    },
    { signal },
  );
  document.getElementById("asset-shelf").onclick = (e) => {
    const add = e.target.closest("[data-shelf-add]");
    if (add) insert(add.dataset.shelfAdd);
    if (e.target.closest("#shelf-import")) open();
  };
  dialog.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (
      !b ||
      ![
        "insert",
        "exportAsset",
        "contribute",
        "downloadCloud",
        "previewCloud",
        "reviewForm",
      ].some((k) => b.dataset[k])
    )
      return;
    try {
      if (b.dataset.insert) {
        await insert(b.dataset.insert);
        dialog.close();
      }
      if (b.dataset.exportAsset) {
        const a = await getAsset(b.dataset.exportAsset),
          url = URL.createObjectURL(a.blob),
          link = document.createElement("a");
        link.href = url;
        link.download = a.name + ".glb";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (b.dataset.contribute)
        showContribute(await getAsset(b.dataset.contribute));
      if (b.dataset.downloadCloud || b.dataset.previewCloud) {
        const a = [...remote, ...queue].find(
          (a) => a.id === (b.dataset.downloadCloud || b.dataset.previewCloud),
        );
        b.disabled = true;
        status("DOWNLOADING & VALIDATING GLB");
        const file = await downloadCloud(a),
          stagedModel = await parseModel(file, [file], {
            origin: a.provenance?.origin || "community",
          });
        preview.clear();
        staged.forEach((s) => releaseObject(s.object));
        staged = [stagedModel];
        stagedModel.asset.communityId = a.id;
        stagedModel.asset.author = a.author;
        stagedModel.asset.license = a.license;
        stagedModel.asset.source = a.source;
        stagedModel.asset.manufacturer = a.manufacturer;
        stagedModel.asset.massG = a.mass_g;
        stagedModel.asset.mechanical = a.mechanical;
        stagedModel.asset.electrical = a.electrical;
        switchTab("import");
        showStages();
        status("OWNER REVIEWED MODEL · CHECK BEFORE USING");
      }
      if (b.dataset.reviewForm) showReview(b.dataset.reviewForm);
    } catch (error) {
      status(error.message);
    } finally {
      b.disabled = false;
    }
  });
  function showContribute(asset) {
    $("#contribute-form").innerHTML =
      `<form id="metadata-form" class="metadata-form"><div class="eyebrow">COMMUNITY CONTRIBUTION / 10 DATA GROUPS</div><h3>Share a model. Keep its context.</h3><p class="muted">GLB được gửi vào vùng riêng tư để chủ kho kiểm tra. Chỉ sau khi duyệt mới xuất hiện trong Community.</p><div class="metadata-grid"><label>01 · Tên model<input name="title" required maxlength="100" value="${esc(asset.name)}" /></label><label>02 · Nhóm<select name="category">${["custom", "frame", "fc", "motor", "esc", "prop", "battery", "power", "gps", "receiver"].map((c) => `<option>${c}</option>`).join("")}</select></label><label>03 · Nhà sản xuất / model<input name="manufacturer" maxlength="120" placeholder="Ví dụ: SpeedyBee F405 V5" /></label><label>04 · Mô tả<textarea name="description" rows="2" maxlength="4000" placeholder="Mục đích, phiên bản, giới hạn…"></textarea></label><label>05 · Tác giả<input name="author" required maxlength="120" value="${esc(asset.author || "")}" /><input name="source" required maxlength="2000" placeholder="URL nguồn / tự thiết kế / prompt AI" value="${esc(asset.source || "")}" /></label><label>06 · Giấy phép<select name="license"><option>CC0</option><option>CC-BY-4.0</option><option>CC-BY-SA-4.0</option></select></label><label>07 · Kích thước & khối lượng<small>${dims(asset)} mm · bbox của mesh</small><input name="massG" type="number" min="0" max="100000" step="any" placeholder="Khối lượng (g), để trống nếu chưa biết" /></label><label>08 · Cơ khí (JSON)<textarea name="mechanical" rows="4" spellcheck="false">${esc(JSON.stringify(asset.mechanical || {}, null, 2))}</textarea><small>mounting_holes_mm, tolerance_mm, material, datasheet_url</small></label><label>09 · Điện / pinout (JSON)<textarea name="electrical" rows="4" spellcheck="false">${esc(JSON.stringify(asset.electrical || {}, null, 2))}</textarea><small>voltage_v, current_a, connector, pins, source_url</small></label><label>10 · Nguồn & chất lượng<small>${esc(asset.sourceFormat.toUpperCase())} → GLB · ${esc(asset.sourceUnit)} · ${esc(asset.sourceUp)}-up<br>${asset.origin === "ai" ? "AI VISUAL / APPROXIMATE" : "IMPORTED / SPECS UNVERIFIED"}<br>SHA-256: ${asset.sha256.slice(0, 16)}…</small></label></div><label class="check review-check"><input name="consent" type="checkbox" required /> Tôi có quyền chia sẻ file và đồng ý gửi chủ kho duyệt.</label><button class="btn primary" type="submit">Request community review →</button><button class="btn secondary" type="button" id="cancel-contribution">Cancel</button></form>`;
    $("#contribute-form").scrollIntoView({ behavior: "smooth" });
    $("#cancel-contribution").onclick = () =>
      $("#contribute-form").replaceChildren();
    $("#metadata-form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("[type=submit]");
      button.disabled = true;
      try {
        await requireUser();
        const data = Object.fromEntries(new FormData(e.target)),
          metadata = validateMetadata({
            ...data,
            massG: data.massG === "" ? null : Number(data.massG),
            mechanical: JSON.parse(data.mechanical),
            electrical: JSON.parse(data.electrical),
            consent: data.consent === "on",
            dimensionsMm: asset.dimensionsMm,
            provenance: {
              sourceFormat: asset.sourceFormat,
              sourceUnit: asset.sourceUnit,
              sourceUp: asset.sourceUp,
              origin: asset.origin,
              sha256: asset.sha256,
              accuracy: "specifications_unverified",
              normalization: "meters_y_up_centered",
              tessellation: CAD.includes(asset.sourceFormat)
                ? { linearDeflectionMm: 0.1, angularDeflection: 0.35 }
                : null,
            },
          });
        const body = new FormData();
        body.set("metadata", JSON.stringify(metadata));
        body.set("file", asset.blob, "model.glb");
        await invoke("community", body);
        $("#contribute-form").replaceChildren();
        status("SUBMITTED · PRIVATE UNTIL OWNER APPROVAL");
        toast("Đã gửi yêu cầu đóng góp. Chưa công khai model.");
      } catch (error) {
        status(error.message);
      } finally {
        button.disabled = false;
      }
    };
  }
  async function authRender() {
    if (!cloud) {
      $("#cloud-auth").innerHTML =
        '<div class="connection-banner" role="status"><strong>Community is not connected yet.</strong><p>Your local workspace is ready. Connect cloud services in your project setup before signing in or sharing models.</p></div>';
      return;
    }
    if (cloud) {
      const result = await cloud.auth.getUser();
      user = result.data.user;
    }
    $("#cloud-auth").innerHTML = user
      ? `<div class="auth-bar"><span>✓ ${esc(user.email)} ${user.app_metadata?.role === "space_lot_admin" ? '<span class="pill success">VAULT OWNER</span>' : ""}</span><button class="text-button" id="auth-out">Sign out</button></div>`
      : `<form id="auth-form" class="auth-bar"><input name="email" type="email" required autocomplete="email" placeholder="Email" aria-label="Email" /><input name="password" type="password" required minlength="8" autocomplete="current-password" placeholder="Password · ≥ 8 characters" aria-label="Mật khẩu" /><button class="btn primary" type="submit">Sign in</button><button class="btn secondary" type="button" id="auth-signup">Create account</button></form>`;
    if (user)
      $("#auth-out").onclick = async () => {
        await cloud.auth.signOut();
        user = null;
        await refreshCommunity();
      };
    else {
      const form = $("#auth-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          if (!cloud) throw Error("Chưa cấu hình Supabase.");
          const v = Object.fromEntries(new FormData(form)),
            result = await cloud.auth.signInWithPassword(v);
          if (result.error) throw result.error;
          form.reset();
          await refreshCommunity();
          status("SIGNED IN");
        } catch (error) {
          status(error.message);
        }
      };
      $("#auth-signup").onclick = async () => {
        if (!form.reportValidity()) return;
        try {
          if (!cloud) throw Error("Chưa cấu hình Supabase.");
          const result = await cloud.auth.signUp(
            Object.fromEntries(new FormData(form)),
          );
          if (result.error) throw result.error;
          form.reset();
          status("Kiểm tra email xác nhận tài khoản, sau đó đăng nhập.");
        } catch (error) {
          status(error.message);
        }
      };
    }
  }
  async function refreshCommunity() {
    try {
      await authRender();
      remote = await approved();
      queue = user ? await pending() : [];
      const requests = user ? await modelRequests() : [];
      $("#model-requests").innerHTML = requests.length
        ? '<h3>Requested components</h3><div class="table-scroll"><table class="asset-table"><thead><tr><th>MODEL</th><th>DETAILS</th><th>STATUS</th></tr></thead><tbody>' +
          requests
            .map(
              (x) =>
                `<tr><td>${esc(x.title)}</td><td>${esc(x.details)}</td><td><span class="pill">${esc(x.status)}</span></td></tr>`,
            )
            .join("") +
          "</tbody></table></div>"
        : "";
      $("#community-assets").innerHTML = table(remote, "community");
      $("#review-queue").innerHTML = queue.length
        ? "<h3>Review queue / My submissions</h3>" + table(queue, "queue")
        : "";
      status(
        cloud
          ? "VAULT CONNECTED · ONLY OWNER-REVIEWED ASSETS ARE PUBLIC"
          : "CLOUD NOT CONFIGURED · LOCAL WORKSPACE AVAILABLE",
      );
    } catch (error) {
      status(error.message);
    }
  }
  $("#refresh-community").onclick = refreshCommunity;
  $("#send-request").onclick = async () => {
    const b = $("#send-request");
    b.disabled = true;
    try {
      await invoke("community", {
        action: "request",
        title: $("#request-title").value,
        details: $("#request-details").value,
      });
      $("#request-title").value = "";
      $("#request-details").value = "";
      await refreshCommunity();
      status("MODEL REQUEST SENT");
    } catch (error) {
      status(error.message);
    } finally {
      b.disabled = false;
    }
  };
  function showReview(id) {
    const a = queue.find((x) => x.id === id);
    $("#review-queue").insertAdjacentHTML(
      "beforeend",
      `<form id="review-form" class="metadata-form"><h3>Review: ${esc(a.title)}</h3><p>${esc(a.description)} · ${esc(a.author)} · ${esc(a.license)}</p><pre>${esc(JSON.stringify({ dimensions_mm: a.dimensions_mm, mechanical: a.mechanical, electrical: a.electrical, provenance: a.provenance, sha256: a.sha256 }, null, 2))}</pre><label>Ghi chú<textarea name="note" maxlength="2000" rows="2"></textarea></label><label class="check review-check"><input name="confirm" type="checkbox" /> Tôi đã Inspect GLB và kiểm tra nguồn, license, đơn vị, kích thước và chất lượng mesh.</label><button class="btn primary" name="decision" value="approved">Approve to community</button><button class="btn danger" name="decision" value="rejected">Reject</button></form>`,
    );
    $("#review-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = new FormData(e.target);
        await invoke("community", {
          action: "review",
          id,
          status: e.submitter.value,
          note: data.get("note"),
          confirm: data.get("confirm") === "on",
        });
        await refreshCommunity();
        status("REVIEW SAVED");
      } catch (error) {
        status(error.message);
      }
    };
    $("#review-form").scrollIntoView();
  }
  function restoreJob() {
    try {
      job = JSON.parse(localStorage.getItem("space-lot-last-job"));
    } catch {}
    $("#ai-resume").hidden = !job;
  }
  async function pollJob() {
    if (!job || !dialog.open || tab !== "ai") return;
    try {
      const result = await invoke("generate-model", {
        action: "status",
        id: job.id,
      });
      $("#ai-status").textContent = `${result.status} · ${result.progress}%`;
      $("#ai-download").hidden = !result.ready;
      if (!["SUCCEEDED", "FAILED", "CANCELED"].includes(result.status))
        pollTimer = setTimeout(pollJob, 5000);
    } catch (error) {
      $("#ai-status").textContent =
        error.message + " · Bấm kiểm tra task để thử đọc lại.";
    }
  }
  $("#ai-resume").onclick = () => {
    clearTimeout(pollTimer);
    pollJob();
  };
  $("#ai-generate").onclick = async () => {
    const b = $("#ai-generate");
    b.disabled = true;
    try {
      await requireUser();
      const size = Number($("#ai-size").value);
      if (!Number.isFinite(size) || size <= 0 || size > 10000)
        throw Error("Nhập kích thước đích hợp lệ.");
      const id = generateUUID();
      job = { id, size };
      localStorage.setItem("space-lot-last-job", JSON.stringify(job));
      $("#ai-resume").hidden = false;
      $("#ai-download").hidden = true;
      $("#ai-status").textContent = "Đang tạo task…";
      await invoke("generate-model", {
        action: "create",
        id,
        prompt: $("#ai-prompt").value,
        consent: $("#ai-consent").checked,
      });
      pollJob();
    } catch (error) {
      $("#ai-status").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
  $("#ai-download").onclick = async () => {
    const b = $("#ai-download");
    b.disabled = true;
    try {
      const blob = await invoke("generate-model", {
        action: "download",
        id: job.id,
      });
      const file = new File([blob], "ai-mesh.glb", {
        type: "model/gltf-binary",
      });
      const s = await parseModel(file, [file], {
        origin: "ai",
        targetMm: job.size,
      });
      s.asset.source = "Meshy task " + job.id;
      preview.clear();
      staged.forEach((x) => releaseObject(x.object));
      staged = [s];
      switchTab("import");
      showStages();
      status("AI MODEL READY · REVIEW APPROXIMATE SCALE");
    } catch (error) {
      $("#ai-status").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
  if (!cloud) {
    $("#ai-generate").disabled = true;
    $("#ai-status").textContent =
      "Connect cloud services and sign in through Community to use AI generation. Local import remains available.";
    $("#send-request").disabled = true;
  }
  refreshLocal();
  return {
    open,
    insert,
    refreshLocal,
    destroy() {
      controller.abort();
      clearTimeout(pollTimer);
      preview.clear();
      staged.forEach((s) => releaseObject(s.object));
      preview.dispose();
      document.getElementById("asset-shelf").onclick = null;
      dialog.remove();
    },
  };
}
