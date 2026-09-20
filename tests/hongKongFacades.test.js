import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildLandmarkFacade, disposeLandmarkFacade } from "../src/city/hongKongFacades.js";

test("facade batches have valid geometry and stay within the detail budget", () => {
  for (const id of ["ifc", "icc", "bank", "hku", "peak"]) {
    const model = buildLandmarkFacade(id);
    try {
      assert.ok(Object.keys(model).length <= 4, `${id}: too many render batches`);
      assert.ok(model.nightWindows?.attributes.position.count > 0, `${id}: missing window lights`);
      let triangles = 0;
      for (const geometry of Object.values(model)) {
        const { position, normal, color } = geometry.attributes;
        assert.equal(position.count, normal.count);
        assert.equal(position.count, color.count);
        for (const attribute of [position, normal, color]) assert.ok(attribute.array.every(Number.isFinite));
        assert.ok(geometry.boundingBox.min.y >= -.01);
        assert.ok(geometry.boundingBox.max.y < 5);
        triangles += position.count / 3;
      }
      assert.ok(triangles < 35000, `${id}: exceeded 35k triangles including night windows`);
    } finally { disposeLandmarkFacade(model); }
  }
});

test("HKU has open arches with recessed glazing and four open courtyards", () => {
  const model = buildLandmarkFacade("hku");
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = Object.entries(model).filter(([kind])=>kind!=="nightWindows").map(([kind, geometry]) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = kind; return mesh;
  });
  const firstHit = (origin, direction) => new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObjects(meshes)[0];
  try {
    const arch = firstHit([.366, .2, -2], [0, 0, 1]);
    const pier = firstHit([.427, .2, -2], [0, 0, 1]);
    assert.equal(arch.object.name, "glass", "the open arch should reveal glazing behind it");
    assert.equal(pier.object.name, "solid");
    assert.ok(arch.distance > pier.distance + .05, "glazing should be visibly recessed");
    for (const x of [-.4, .4]) for (const z of [-.15, .4]) {
      const courtyard = firstHit([x, 4, z], [0, -1, 0]);
      assert.ok(courtyard.point.y < .2, "courtyard must remain open below the roofline");
    }
  } finally { disposeLandmarkFacade(model); material.dispose(); }
});
