import * as THREE from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Detailed telemetry & health analysis of a 3D model.
 * Detects geometry scale abnormalities, polygon density, sub-mesh count, and render viability.
 *
 * @param {THREE.Object3D} root
 * @param {File} file
 * @param {{ unit?: string, up?: string }} options
 * @returns {object} Full model diagnostics
 */
export function analyzeModelGeometry(root, file, options = {}) {
  let triangles = 0;
  let vertices = 0;
  let meshCount = 0;
  let hasNaN = false;
  let hasSkinned = false;
  let hasNormal = true;

  root.traverse((o) => {
    if (!o.isMesh) return;
    meshCount++;
    if (o.isSkinnedMesh) hasSkinned = true;
    const geom = o.geometry;
    if (!geom) return;

    const pos = geom.getAttribute('position');
    if (pos) {
      vertices += pos.count;
      triangles += Math.round((geom.index ? geom.index.count : pos.count) / 3);
      for (let i = 0; i < Math.min(pos.array.length, 300); i++) {
        if (!Number.isFinite(pos.array[i])) hasNaN = true;
      }
    }
    if (!geom.getAttribute('normal')) hasNormal = false;
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  // In normalized space, 1 unit = 1 meter, so multiply by 1000 for mm
  const dimsMm = [
    Number((size.x * 1000).toFixed(1)),
    Number((size.y * 1000).toFixed(1)),
    Number((size.z * 1000).toFixed(1)),
  ];
  const maxDimMm = Math.max(...dimsMm);
  const minDimMm = Math.min(...dimsMm.filter((d) => d > 0));

  const ext = (file?.name || '').toLowerCase().split('.').pop() || 'unknown';
  const formatName = ext.toUpperCase();

  const issues = [];
  let healthLevel = 'optimal'; // 'optimal' | 'moderate' | 'heavy' | 'critical' | 'warning' | 'corrupt'
  let healthLabel = 'Tối ưu (Optimal)';
  let healthColor = '#00ff88'; // green
  let recommendation = 'Mô hình chuẩn, render mượt mà 60 FPS trên mọi thiết bị.';

  if (hasNaN || meshCount === 0 || triangles === 0) {
    healthLevel = 'corrupt';
    healthLabel = 'Lỗi dữ liệu (Corrupt)';
    healthColor = '#ef4444';
    recommendation = 'File chứa dữ liệu tọa độ không hợp lệ hoặc không có mặt tam giác.';
    issues.push('Tọa độ đỉnh chứa NaN / Infinity hoặc không có mesh hiển thị.');
  } else if (maxDimMm > 2500 || (minDimMm < 0.5 && maxDimMm < 5)) {
    healthLevel = 'warning';
    healthLabel = 'Cảnh báo kích thước (Scale Issue)';
    healthColor = '#f59e0b';
    recommendation = 'Kích thước bất thường so với drone chuẩn (0.5 mm - 1500 mm). Hãy kiểm tra lại đơn vị nguồn (mm/cm/m/in).';
    issues.push(`Kích thước đo được: ${dimsMm.join(' × ')} mm`);
  } else if (triangles > 400000) {
    healthLevel = 'critical';
    healthLabel = 'Quá tải tam giác (Critical)';
    healthColor = '#ef4444';
    recommendation = 'Mesh cực dày (> 400.000 tam giác). Nguy cơ tràn VRAM và giảm FPS nghiêm trọng trên máy yếu/mobile.';
    issues.push(`Tổng cộng ${triangles.toLocaleString()} tam giác. Khuyến nghị giảm mesh 50% - 75%.`);
  } else if (triangles > 150000) {
    healthLevel = 'heavy';
    healthLabel = 'Mesh dày (Heavy)';
    healthColor = '#f59e0b';
    recommendation = 'Độ chi tiết cao (> 150.000 tam giác). Nên dùng tính năng Giảm tam giác để tăng tốc độ load.';
    issues.push('Có thể gây giật nhẹ khi di chuyển camera nếu scene có nhiều linh kiện.');
  } else if (triangles > 60000) {
    healthLevel = 'moderate';
    healthLabel = 'Tiêu chuẩn (Standard)';
    healthColor = '#38bdf8';
    recommendation = 'Độ chi tiết cân đối, hiển thị sắc nét trên cả desktop và laptop.';
  }

  if (hasSkinned) {
    issues.push('Mô hình có xương/animation: chỉ mesh tĩnh được đưa vào scene.');
  }
  if (!hasNormal) {
    issues.push('Thiếu vector pháp tuyến: hệ thống đã tự động tính toán lại pháp tuyến.');
  }

  return {
    format: formatName,
    fileName: file?.name || 'model',
    fileSizeBytes: file?.size || 0,
    dimensionsMm: dimsMm,
    maxDimMm,
    meshCount,
    triangleCount: triangles,
    vertexCount: vertices,
    health: {
      level: healthLevel,
      label: healthLabel,
      color: healthColor,
      recommendation,
      issues,
    },
  };
}

/**
 * Decimates and simplifies 3D mesh geometry while preserving sharp CAD feature edges.
 * Uses Stan Melax polygon reduction combined with angle-weighted crease normal generation.
 *
 * @param {THREE.Object3D} root - Three.js Group/Object to optimize
 * @param {number} targetReductionRatio - 0.1 (10% reduction) to 0.85 (85% reduction)
 * @param {number} creaseAngleDeg - Feature edge threshold angle (default 32 degrees for aerospace/mechanical CAD)
 * @returns {{ beforeTris: number, afterTris: number, reductionPercent: number }}
 */
export function decimateModel(root, targetReductionRatio = 0.5, creaseAngleDeg = 32) {
  const modifier = new SimplifyModifier();
  const creaseRad = THREE.MathUtils.degToRad(creaseAngleDeg);

  let beforeTris = 0;
  let afterTris = 0;

  // First pass: count before
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      beforeTris += Math.round(
        (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3,
      );
    }
  });

  const clampedRatio = Math.max(0.1, Math.min(0.85, targetReductionRatio));

  // Second pass: simplify each mesh
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    let geom = o.geometry;

    // 0. Ensure vertices are welded/merged for clean topological decimation (crucial for STL, OBJ, CAD meshes)
    try {
      geom = BufferGeometryUtils.mergeVertices(geom);
    } catch (_) {}

    const pos = geom.getAttribute('position');
    if (!pos || pos.count < 15) return; // Skip degenerate or ultra-low poly parts

    const currentVerts = pos.count;
    const toRemove = Math.floor(currentVerts * clampedRatio);
    if (toRemove <= 0) return;

    try {
      // 1. Simplify vertices
      let simplified = modifier.modify(geom, toRemove);

      // 2. Preserve sharp mechanical feature edges with creased normal splitting
      simplified = BufferGeometryUtils.toCreasedNormals(simplified, creaseRad);
      simplified.computeBoundingBox();
      simplified.computeBoundingSphere();

      // 3. Replace geometry cleanly
      o.geometry.dispose();
      o.geometry = simplified;
    } catch (err) {
      console.warn('Decimation skipped for mesh:', o.name || 'unnamed', err);
    }
  });

  // Third pass: count after
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      afterTris += Math.round(
        (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3,
      );
    }
  });

  const reductionPercent = beforeTris > 0 ? Number(((1 - afterTris / beforeTris) * 100).toFixed(1)) : 0;

  return {
    beforeTris,
    afterTris,
    reductionPercent,
  };
}
