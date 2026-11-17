import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoConnectRooms,
  clampPitchDeg,
  hasReal3dContent,
  isValidGlbMagic,
  isValidGltfJson,
  isValidPanoramaAspectRatio,
  moveRoomOrder,
  normalizeYawDeg,
  removeRoomAndHotspots,
  sanitizeTourHotspots,
  sphericalDegToVector3,
  validate3DModelFile,
  validatePanoramaImageFile,
  vector3ToSphericalDeg,
} from './tour3d';

test('validate3DModelFile validates GLB/GLTF extensions and 25MB limit', () => {
  assert.equal(validate3DModelFile({ name: 'villa.glb', size: 2048 }).valid, true);
  assert.equal(validate3DModelFile({ name: 'villa.gltf', size: 2048 }).valid, true);
  assert.equal(validate3DModelFile({ name: 'photo.jpg', size: 2048 }).valid, false);
  assert.equal(validate3DModelFile({ name: 'huge.glb', size: 26 * 1024 * 1024 }).valid, false);
  assert.equal(validate3DModelFile({ name: 'empty.glb', size: 0 }).valid, false);
});

test('validatePanoramaImageFile enforces 2:1 equirectangular ratio and rejects regular photos', () => {
  assert.equal(
    isValidPanoramaAspectRatio(4096, 2048),
    true
  );
  assert.equal(
    isValidPanoramaAspectRatio(1600, 1200),
    false
  );

  const validPano = validatePanoramaImageFile({
    name: 'living_360.jpg',
    type: 'image/jpeg',
    size: 1024 * 1024,
    width: 4000,
    height: 2000,
  });
  assert.equal(validPano.valid, true);

  const regularPhoto = validatePanoramaImageFile({
    name: 'kitchen.jpg',
    type: 'image/jpeg',
    size: 1024 * 1024,
    width: 1920,
    height: 1080,
  });
  assert.equal(regularPhoto.valid, false);
  assert.ok(regularPhoto.error?.includes('2:1'));
});

test('isValidGlbMagic and isValidGltfJson detect authentic 3D files', () => {
  const glbBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);
  const badBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(isValidGlbMagic(glbBytes), true);
  assert.equal(isValidGlbMagic(badBytes), false);

  assert.equal(isValidGltfJson('{"asset":{"version":"2.0"},"scenes":[]}'), true);
  assert.equal(isValidGltfJson('{"hello":"world"}'), false);
});

test('hasReal3dContent returns false when no model, panorama rooms, or virtual tour URL exist', () => {
  assert.equal(hasReal3dContent({ model3dUrl: '', panoramaUrl: '', virtualTourUrl: '', tourRooms: [] }), false);
  assert.equal(hasReal3dContent({ model3dUrl: '/uploads/samples/villa.glb' }), true);
  assert.equal(
    hasReal3dContent({
      tourRooms: [{ roomKey: 'r1', roomName: 'Гостиная', roomOrder: 0, filePath: '/uploads/r1.jpg' }],
    }),
    true
  );
});

test('spherical coordinate round-trip preserves yaw and pitch accuracy', () => {
  const vec = sphericalDegToVector3(45, -15, 25);
  const res = vector3ToSphericalDeg(vec.x, vec.y, vec.z);
  assert.ok(Math.abs(res.yaw - 45) < 0.05);
  assert.ok(Math.abs(res.pitch - -15) < 0.05);
  assert.equal(normalizeYawDeg(270), -90);
  assert.equal(clampPitchDeg(120), 85);
});

test('autoConnectRooms, moveRoomOrder, removeRoomAndHotspots manage tour graph safely', () => {
  const rooms = [
    { roomKey: 'hall', roomName: 'Холл', roomOrder: 0, filePath: '/uploads/1.jpg' },
    { roomKey: 'living', roomName: 'Гостиная', roomOrder: 1, filePath: '/uploads/2.jpg' },
    { roomKey: 'terrace', roomName: 'Терраса', roomOrder: 2, filePath: '/uploads/3.jpg' },
  ];

  const connections = autoConnectRooms(rooms);
  assert.equal(connections.length, 4);
  assert.equal(connections[0].fromRoomKey, 'hall');
  assert.equal(connections[0].targetRoomKey, 'living');
  assert.equal(connections[1].fromRoomKey, 'living');
  assert.equal(connections[1].targetRoomKey, 'hall');

  const reordered = moveRoomOrder(rooms, 2, -1);
  assert.equal(reordered[1].roomKey, 'terrace');
  assert.equal(reordered[1].roomOrder, 1);

  const cleaned = removeRoomAndHotspots(rooms, connections, 'living');
  assert.equal(cleaned.rooms.length, 2);
  assert.equal(cleaned.hotspots.length, 0);

  const sanitized = sanitizeTourHotspots(rooms, [
    { fromRoomKey: 'hall', targetRoomKey: 'hall', label: 'Self', yaw: 0, pitch: 0 },
    { fromRoomKey: 'hall', targetRoomKey: 'terrace', label: 'Терраса', yaw: 380, pitch: -100 },
  ]);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].yaw, 20);
  assert.equal(sanitized[0].pitch, -85);
});
