import * as THREE from "three";
import { assetVisual } from "./assets/importer.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { instanceComponent, categoryOf } from "./engineering.js";

const U = 0.01; // 1 scene unit = 100 engineering millimeters.
export const mmToWorld = (p) =>
  new THREE.Vector3(p[0] * U, p[2] * U, -p[1] * U); // Engineering X-forward/Y-right/Z-up -> Three Y-up.
function mat(color, metalness = 0.1, roughness = 0.65) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
const PALETTE = {
  frame: 0x43566b,
  motor: 0x528ac0,
  esc: 0x313a51,
  fc: 0x228a91,
  battery: 0x556477,
  power: 0xa47946,
  gps: 0xdddddd,
  receiver: 0x695b92,
  prop: 0x9bb6d2,
};
const dark = mat(0x151e29, 0.15),
  metallic = mat(0x9faaba, 0.75, 0.3),
  copper = mat(0xc29259, 0.6),
  pcb = mat(0x147e78, 0.1, 0.5);
function box(w, h, d, material, pos = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * U, h * U, d * U),
    material,
  );
  mesh.position.set(pos[0] * U, pos[1] * U, pos[2] * U);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cylinder(radius, height, material, pos = [0, 0, 0], segments = 32) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * U, radius * U, height * U, segments),
    material,
  );
  mesh.position.set(pos[0] * U, pos[1] * U, pos[2] * U);
  mesh.castShadow = true;
  return mesh;
}
function sphere(radius, material, pos = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * U, 16, 12),
    material,
  );
  mesh.position.set(...pos.map((x) => x * U));
  return mesh;
}
function makePart(comp) {
  const g = new THREE.Group();
  const type = comp.category;
  const primary = mat(
    PALETTE[type],
    type === "motor" ? 0.65 : 0.2,
    type === "motor" ? 0.3 : 0.65,
  );
  if (type === "frame") {
    g.add(box(136, 10, 120, mat(0x344255, 0.2), [0, 0, 0]));
    g.add(box(110, 3, 96, mat(0x71839a, 0.2), [0, 9, 0]));
    for (const p of comp.anchors?.motors || []) {
      const x = p[0] * U,
        z = -p[1] * U;
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(Math.hypot(x, z), 0.095, 0.21),
        mat(0x455c71, 0.4),
      );
      arm.position.set(x / 2, 0, z / 2);
      arm.rotation.y = -Math.atan2(z, x);
      g.add(arm);
      g.add(cylinder(20, 8, mat(0x344658, 0.4), [p[0], 2, -p[1]]));
      g.add(cylinder(6, 2, metallic, [p[0], 8, -p[1]]));
    }
    for (const x of [-42, 42])
      for (const z of [-35, 35]) g.add(cylinder(3.2, 18, metallic, [x, 19, z]));
    for (const x of [-38, 38])
      for (const z of [-40, 40])
        g.add(box(6, 46, 6, mat(0x304358), [x, -26, z]));
  } else if (type === "motor") {
    g.add(cylinder(14, 19, primary, [0, 0, 0]));
    g.add(cylinder(12.5, 4, metallic, [0, 11, 0]));
    g.add(cylinder(2.9, 17, metallic, [0, 22, 0]));
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12;
      g.add(
        box(3, 12, 2, mat(0x284862, 0.25), [
          Math.cos(a) * 13,
          0,
          Math.sin(a) * 13,
        ]),
      );
    }
  } else if (type === "prop") {
    g.add(cylinder(9, 5, dark));
    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Group();
      blade.rotation.y = i * Math.PI;
      const geo = new THREE.BoxGeometry(116 * U, 3 * U, 19 * U);
      const mesh = new THREE.Mesh(geo, primary);
      mesh.position.x = 64 * U;
      mesh.rotation.x = i === 0 ? 0.08 : -0.08;
      blade.add(mesh);
      g.add(blade);
    }
    g.add(cylinder(4.5, 9, metallic));
  } else if (type === "esc") {
    g.add(box(47, 12, 25, dark));
    g.add(box(37, 12.3, 26, primary));
    for (let i = -1; i <= 1; i++) {
      g.add(box(13, 1.4, 1.5, copper, [17, 7, i * 7]));
    }
  } else if (type === "fc") {
    g.add(box(40, 2, 40, pcb));
    g.add(box(16, 5, 16, dark, [0, 4, 0]));
    g.add(box(7, 2, 12, mat(0x9baeb9), [-12, 3, 8]));
    for (const x of [-15.25, 15.25])
      for (const z of [-15.25, 15.25])
        g.add(cylinder(2.8, 3, metallic, [x, 1.5, z]));
    for (let n = 0; n < 7; n++)
      for (const z of [-18, 18])
        g.add(box(2.4, 3.5, 3.4, copper, [-12 + n * 4, 3.5, z]));
    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.1, 3),
      mat(0xd0f7ea),
    );
    pointer.rotation.z = -Math.PI / 2;
    pointer.position.set(0.08, 0.038, 0);
    g.add(pointer);
  } else if (type === "battery") {
    g.add(box(134, 33, 44, dark));
    g.add(box(130, 34, 42, primary));
    g.add(box(60, 0.6, 43, mat(0xf2bd62), [-15, 17.3, 0]));
    for (const x of [-40, 35]) g.add(box(9, 35, 45, mat(0x202a34), [x, 0, 0]));
    g.add(box(6, 6, 9, copper, [67, 7, 0]));
  } else if (type === "gps") {
    g.add(cylinder(23, 13, primary));
    g.add(cylinder(19, 2.5, mat(0xf3f6fa), [0, 7.5, 0]));
    g.add(cylinder(5, 12, metallic, [0, -12, 0]));
    g.add(box(17, 3, 17, mat(0xb5bdc8), [0, 10, 0]));
  } else if (type === "receiver") {
    g.add(box(30, 10, 19, primary));
    g.add(box(24, 1, 11, mat(0xb6a8da), [0, 5.5, 0]));
    for (let i = -1; i <= 1; i += 2) {
      const a = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.47, 8),
        dark,
      );
      a.rotation.z = i * 0.5;
      a.position.set(i * 0.1, 0.22, 0);
      g.add(a);
    }
  } else if (type === "power") {
    g.add(box(38, 12, 21, primary));
    g.add(box(24, 13, 17, dark));
    g.add(box(7, 4, 14, copper, [14, 7, 0]));
  }
  return g;
}
function disposeGroup(g) {
  g.traverse((x) => {
    if (x.isMesh) {
      x.geometry?.dispose();
      if (Array.isArray(x.material)) x.material.forEach((m) => m.dispose());
      else if (
        x.material &&
        ![metallic, dark, pcb, copper].includes(x.material)
      )
        x.material.dispose();
    }
  });
}
function displayPos(inst, category, factor) {
  const p = [...inst.positionMm];
  if (!factor || category === "frame") return p;
  const radial = Math.hypot(p[0], p[1]) || 1;
  const fac = factor / 100;
  const lift =
    {
      motor: 54,
      prop: 110,
      esc: -50,
      battery: 150,
      fc: 105,
      power: -60,
      gps: 185,
      receiver: 95,
    }[category] ?? 65;
  p[2] += lift * fac;
  if (["motor", "prop", "esc"].includes(category)) {
    p[0] += (p[0] / radial) * 54 * fac;
    p[1] += (p[1] / radial) * 54 * fac;
  }
  return p;
}

export class DroneScene {
  constructor(container, onSelect, onMove) {
    this.container = container;
    this.onSelect = onSelect;
    this.onMove = onMove;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.016);
    this.camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.01,
      250,
    );
    this.camera.position.set(5.7, 4.8, 6.4);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.15, 0);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 1.5;
    this.orbit.maxDistance = 18;
    this.orbit.update();
    this.cameraHome();
    this.scene.add(new THREE.HemisphereLight(0xddeafb, 0x202d40, 2.25));
    const spot = new THREE.DirectionalLight(0xffffff, 3.2);
    spot.position.set(5, 10, 7);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = 30;
    spot.shadow.camera.left = -6;
    spot.shadow.camera.right = 6;
    spot.shadow.camera.top = 6;
    spot.shadow.camera.bottom = -6;
    this.scene.add(spot);
    const fill = new THREE.DirectionalLight(0xd6b582, 0.9);
    fill.position.set(-6, 3, -4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x00ff88, 1.4);
    rim.position.set(-2, 4, -6);
    this.scene.add(rim);
    this.grid = new THREE.GridHelper(9, 36, 0x00ff88, 0x072814);
    this.grid.position.y = -0.37;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.scene.add(this.grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.ShadowMaterial({ opacity: 0.13 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.372;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.partsGroup = new THREE.Group();
    this.scene.add(this.partsGroup);
    this.wiresGroup = new THREE.Group();
    this.scene.add(this.wiresGroup);
    this.discsGroup = new THREE.Group();
    this.scene.add(this.discsGroup);
    this.previewGroup = new THREE.Group();
    this.scene.add(this.previewGroup);
    this.previewPart = null;
    this.previewLabel = null;
    this.items = new Map();
    this.labels = new Map();
    this.sign = "";
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragging = null;
    this.pointerStart = null;
    this.prevProject = null;
    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "label-layer";
    container.appendChild(this.labelLayer);
    const el = this.renderer.domElement;
    this.onDown = (e) => this.down(e);
    this.onPointerMove = (e) => this.move(e);
    this.onUp = (e) => this.up(e);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.renderer.setAnimationLoop(() => this.animate());
  }
  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.orbit.dispose();
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.onPointerMove,
    );
    window.removeEventListener("pointerup", this.onUp);
    this.items.clear();
    this.scene.traverse((node) => {
      node.geometry?.dispose();
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.filter(Boolean).forEach((material) => {
        if (![metallic, dark, pcb, copper].includes(material))
          material.dispose();
      });
      node.shadow?.map?.dispose();
    });
    if (this.previewLabel) {
      this.previewLabel.remove();
      this.previewLabel = null;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
  }
  setPreviewPart(preview) {
    this.previewPart = preview;
    for (const obj of [...this.previewGroup.children]) {
      this.previewGroup.remove(obj);
      disposeGroup(obj);
    }
    if (!preview) {
      if (this.previewLabel) {
        this.previewLabel.remove();
        this.previewLabel = null;
      }
      return;
    }
    const comp =
      this.catalog?.find((c) => c.id === preview.componentId) || null;
    if (!comp) return;

    const g = makePart(comp);
    g.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material = node.material.clone();
        node.material.transparent = true;
        node.material.opacity = 0.88;
        if (node.material.emissive) {
          node.material.emissive.setHex(0x00ffaa);
          node.material.emissiveIntensity = 0.45;
        }
      }
    });

    const box = new THREE.BoxHelper(g, 0x00ff88);
    box.material.transparent = true;
    box.material.opacity = 0.75;
    g.add(box);

    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.15, 32),
      new THREE.MeshBasicMaterial({
        color: 0x00ffaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
    );
    groundRing.name = "previewGroundRing";
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = -(preview.positionMm[2] * U) - 0.36;
    g.add(groundRing);

    g.position.copy(mmToWorld(preview.positionMm));
    this.previewGroup.add(g);

    if (!this.previewLabel) {
      this.previewLabel = document.createElement("div");
      this.previewLabel.className = "part-label staging-label selected";
      this.labelLayer.appendChild(this.previewLabel);
    }
    this.previewLabel.textContent = `REVIEW: ${comp.name} [${preview.positionMm.join(", ")}]`;
    this.previewLabel.style.display = "block";
  }
  updatePreviewPosition(pos) {
    if (!this.previewPart) return;
    this.previewPart.positionMm = pos;
    const g = this.previewGroup.children[0];
    if (g) {
      g.position.copy(mmToWorld(pos));
      const ring = g.getObjectByName("previewGroundRing");
      if (ring) {
        ring.position.y = -(pos[2] * U) - 0.36;
      }
    }
    if (this.previewLabel) {
      const comp =
        this.catalog?.find((c) => c.id === this.previewPart.componentId) || null;
      this.previewLabel.textContent = `REVIEW: ${comp?.name || "Part"} [${pos.join(", ")}]`;
    }
  }
  dropPosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (
      !this.ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        hit,
      )
    )
      return [0, 0, 40];
    return [Math.round(hit.x / U), Math.round(-hit.z / U), 40];
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  cameraHome() {
    const factor = this.camera.aspect > 1.6 ? 0.72 : 1;
    this.camera.position.set(5.7 * factor, 4.8 * factor, 6.4 * factor);
    this.orbit.target.set(0, 0.15, 0);
    this.orbit.update();
  }
  cameraFit() {
    const bounds = new THREE.Box3().setFromObject(this.partsGroup);
    if (bounds.isEmpty()) return this.cameraHome();
    const center = bounds.getCenter(new THREE.Vector3()),
      direction = this.camera.position
        .clone()
        .sub(this.orbit.target)
        .normalize();
    const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), direction)
        .normalize(),
      up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)),
      tanH = tanV * this.camera.aspect;
    let distance = 1.5;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(center),
            depth = corner.dot(direction);
          distance = Math.max(
            distance,
            depth + (Math.abs(corner.dot(right)) * 1.35) / tanH,
            depth + (Math.abs(corner.dot(up)) * 1.5) / tanV,
          );
        }
    this.orbit.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.orbit.maxDistance = Math.max(18, distance * 3);
    this.camera.far = Math.max(250, distance * 10);
    this.camera.updateProjectionMatrix();
    this.orbit.update();
  }
  cameraTop() {
    this.camera.position.set(0, 8, 0.01);
    this.orbit.target.set(0, 0, 0);
    this.orbit.update();
  }
  rayHit(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.partsGroup.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData.instanceId) node = node.parent;
      if (node?.userData.instanceId) return node.userData.instanceId;
    }
    return null;
  }
  down(event) {
    if (event.button !== 0) return;
    this.pointerStart = [event.clientX, event.clientY];
    const id = this.rayHit(event);
    if (this.options?.tool === "move" && id && this.options?.explode === 0) {
      this.onSelect(id);
      this.dragging = {
        id,
        plane: new THREE.Plane(
          new THREE.Vector3(0, 1, 0),
          -mmToWorld(this.project.instances.find((x) => x.id === id).positionMm)
            .y,
        ),
      };
      const hit = new THREE.Vector3();
      this.ray.ray.intersectPlane(this.dragging.plane, hit);
      const old = mmToWorld(
        this.project.instances.find((x) => x.id === id).positionMm,
      );
      this.dragging.dx = old.x - hit.x;
      this.dragging.dz = old.z - hit.z;
      this.orbit.enabled = false;
    }
  }
  move(event) {
    if (!this.dragging) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.dragging.plane, hit)) return;
    const p = this.project.instances.find((x) => x.id === this.dragging.id);
    if (!p) return;
    const x = (hit.x + this.dragging.dx) / U,
      y = -(hit.z + this.dragging.dz) / U;
    this.onMove(p.id, [Math.round(x), Math.round(y), p.positionMm[2]]);
  }
  up(event) {
    if (this.dragging) {
      this.dragging = null;
      this.orbit.enabled = true;
      return;
    }
    if (!this.pointerStart) return;
    if (
      Math.hypot(
        event.clientX - this.pointerStart[0],
        event.clientY - this.pointerStart[1],
      ) < 6 &&
      event.target === this.renderer.domElement
    )
      this.onSelect(this.rayHit(event));
    this.pointerStart = null;
  }
  setData(project, catalog, opts) {
    this.project = project;
    this.catalog = catalog;
    this.options = opts;
    const sign = project.instances
      .map((x) => x.id + ":" + x.componentId)
      .join("|");
    if (sign !== this.sign) {
      this.sign = sign;
      this.rebuild();
    }
    for (const inst of project.instances) {
      const group = this.items.get(inst.id);
      if (!group) continue;
      const category = categoryOf(catalog, inst);
      group.position.copy(mmToWorld(displayPos(inst, category, opts.explode)));
      group.traverse((x) => {
        if (
          x.isMesh &&
          x.material?.emissive &&
          ![dark, metallic, pcb, copper].includes(x.material)
        ) {
          x.material.emissive.setHex(
            inst.id === opts.selectedId ? 0x16354c : 0x000000,
          );
          x.material.emissiveIntensity = inst.id === opts.selectedId ? 0.42 : 0;
        }
      });
      const label = this.labels.get(inst.id);
      if (label) {
        label.style.display =
          opts.showLabels &&
          (["fc", "battery", "gps", "frame", "motor"].includes(category) ||
            inst.id === opts.selectedId)
            ? "block"
            : "none";
        label.classList.toggle("selected", inst.id === opts.selectedId);
      }
    }
    this.updateWires();
    this.updateClearance();
  }
  rebuild() {
    for (const obj of [...this.partsGroup.children]) {
      this.partsGroup.remove(obj);
      disposeGroup(obj);
    }
    this.items.clear();
    this.labels.clear();
    this.labelLayer.replaceChildren();
    for (const inst of this.project.instances) {
      const comp = instanceComponent(this.catalog, inst);
      if (!comp) continue;
      const g = makePart(comp);
      g.userData.instanceId = inst.id;
      g.userData.category = comp.category;
      this.partsGroup.add(g);
      this.items.set(inst.id, g);
      if (comp.assetId) {
        // A visible placeholder is replaced only if its instance still exists after async loading.
        const placeholder = box(
          ...[comp.dimensionsMm[0], comp.dimensionsMm[2], comp.dimensionsMm[1]],
          new THREE.MeshStandardMaterial({ color: 0x847760, wireframe: true }),
        );
        g.add(placeholder);
        assetVisual(comp.assetId)
          .then((visual) => {
            if (this.items.get(inst.id) !== g) {
              disposeGroup(visual);
              return;
            }
            g.remove(placeholder);
            disposeGroup(placeholder);
            g.add(visual);
          })
          .catch((error) => {
            g.userData.assetError = error.message;
            this.container.dispatchEvent(
              new CustomEvent("asset-error", { detail: error.message }),
            );
          });
      }
      const label = document.createElement("div");
      label.className = "part-label";
      label.textContent = comp.category.toUpperCase() + " · " + inst.id;
      this.labelLayer.appendChild(label);
      this.labels.set(inst.id, label);
    }
  }
  updateWires() {
    for (const x of [...this.wiresGroup.children]) {
      this.wiresGroup.remove(x);
      disposeGroup(x);
    }
    this.wiresGroup.visible =
      this.options.mode === "wiring" && this.options.explode === 0;
    if (!this.wiresGroup.visible) return;
    for (const w of this.project.connections) {
      if (
        this.options.highlightedWire !== "all" &&
        this.options.highlightedWire !== w.id
      )
        continue;
      const a = this.project.instances.find((i) => i.id === w.from),
        b = this.project.instances.find((i) => i.id === w.to);
      if (!a || !b) continue;
      const va = mmToWorld(a.positionMm),
        vb = mmToWorld(b.positionMm);
      const middle = va
        .clone()
        .add(vb)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 0.28, 0));
      const curve = new THREE.CatmullRomCurve3([va, middle, vb]);
      const col = w.kind === "power" ? 0xf2ad5e : 0x61c5dc;
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.012, 7, false),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.92,
          depthTest: false,
        }),
      );
      this.wiresGroup.add(mesh);
      for (const v of [va, vb]) {
        const sph = new THREE.Mesh(
          new THREE.SphereGeometry(0.033, 10, 8),
          new THREE.MeshBasicMaterial({ color: col, depthTest: false }),
        );
        sph.position.copy(v);
        this.wiresGroup.add(sph);
      }
    }
  }
  updateClearance() {
    for (const x of [...this.discsGroup.children]) {
      this.discsGroup.remove(x);
      disposeGroup(x);
    }
    if (!this.options.showClearance) return;
    for (const inst of this.project.instances.filter(
      (x) => categoryOf(this.catalog, x) === "prop",
    )) {
      const comp = instanceComponent(this.catalog, inst);
      const radius = (comp.diameterMm * U) / 2;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.012, radius, 80),
        new THREE.MeshBasicMaterial({
          color: 0x74bfff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(
        mmToWorld(displayPos(inst, "prop", this.options.explode)),
      );
      ring.position.y -= 0.035;
      this.discsGroup.add(ring);
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 80),
        new THREE.MeshBasicMaterial({
          color: 0x6da0cf,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.055,
          depthWrite: false,
        }),
      );
      disk.rotation.x = -Math.PI / 2;
      disk.position.copy(ring.position);
      this.discsGroup.add(disk);
    }
  }
  animate() {
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
    const rect = this.container.getBoundingClientRect();
    for (const [id, label] of this.labels) {
      if (label.style.display === "none") continue;
      const g = this.items.get(id);
      if (!g) continue;
      const v = g.position.clone();
      v.y += 0.27;
      v.project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) {
        label.style.visibility = "hidden";
        continue;
      }
      label.style.visibility = "visible";
      label.style.transform = `translate(-50%,-50%) translate(${Math.round(((v.x + 1) * rect.width) / 2)}px,${Math.round(((-v.y + 1) * rect.height) / 2)}px)`;
    }
    if (
      this.previewLabel &&
      this.previewLabel.style.display !== "none" &&
      this.previewGroup.children[0]
    ) {
      const g = this.previewGroup.children[0];
      const v = g.position.clone();
      v.y += 0.27;
      v.project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) {
        this.previewLabel.style.visibility = "hidden";
      } else {
        this.previewLabel.style.visibility = "visible";
        this.previewLabel.style.transform = `translate(-50%,-50%) translate(${Math.round(((v.x + 1) * rect.width) / 2)}px,${Math.round(((-v.y + 1) * rect.height) / 2)}px)`;
      }
    }
  }
}
