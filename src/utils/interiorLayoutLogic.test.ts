import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampItemToHouseBounds,
  createHistoryStack,
  evaluateSceneCollisions,
  getDefaultFurnishedHouseItems,
  HOUSE_ROOMS,
  pushHistoryState,
  redoHistoryState,
  snapValueToGrid,
  UHD_4K_DIMENSIONS,
  undoHistoryState,
  type FurnitureItem,
} from './interiorLayoutLogic.ts';

describe('interiorLayoutLogic', () => {
  it('verifies default furnished house has zero collisions and populates both floors', () => {
    const items = getDefaultFurnishedHouseItems();
    assert.ok(items.length >= 20, 'Should have at least 20 detailed furniture items across rooms');

    const floor1Count = items.filter((i) => i.floor === 1).length;
    const floor2Count = items.filter((i) => i.floor === 2).length;
    assert.ok(floor1Count >= 10, 'Floor 1 should be well furnished');
    assert.ok(floor2Count >= 8, 'Floor 2 should be well furnished');

    const report = evaluateSceneCollisions(items);
    assert.equal(report.overlappingPairs.length, 0, `Default items should not overlap: ${JSON.stringify(report.overlappingPairs)}`);
    assert.equal(report.outOfBoundsIds.length, 0, `Default items should be inside bounds: ${JSON.stringify(report.outOfBoundsIds)}`);
    assert.equal(report.blockedDoors.length, 0, `Default items should not block doors: ${JSON.stringify(report.blockedDoors)}`);
  });

  it('detects furniture overlap on the same floor and ignores rugs', () => {
    const sofaA: FurnitureItem = {
      id: 'a',
      name: 'Sofa A',
      category: 'living',
      type: 'sofa_modern',
      roomId: 'living',
      floor: 1,
      x: -3.0,
      y: 0,
      z: 0,
      width: 2.0,
      height: 0.85,
      depth: 1.0,
      rotationY: 0,
      color: '#222222',
      material: 'fabric',
    };
    const tableOverlap: FurnitureItem = {
      ...sofaA,
      id: 'b',
      name: 'Coffee Table',
      type: 'coffee_table',
      x: -2.5,
      z: 0.2,
      width: 1.2,
      depth: 0.8,
    };
    const rugUnderneath: FurnitureItem = {
      ...sofaA,
      id: 'rug_1',
      name: 'Rug',
      type: 'rug',
      height: 0.02,
      width: 3.0,
      depth: 2.5,
    };

    const report = evaluateSceneCollisions([sofaA, tableOverlap, rugUnderneath]);
    assert.equal(report.hasIssues, true);
    assert.deepEqual(report.overlappingPairs, [['a', 'b']]);
  });

  it('detects blocked doorways when a cabinet is placed right in front of an entrance', () => {
    const blockingWardrobe: FurnitureItem = {
      id: 'wardrobe_block',
      name: 'Blocking Wardrobe',
      category: 'bedroom',
      type: 'wardrobe',
      roomId: 'hallway',
      floor: 1,
      x: 1.8,
      y: 0,
      z: 4.6,
      width: 1.5,
      height: 2.2,
      depth: 0.6,
      rotationY: 0,
      color: '#333333',
      material: 'wood',
    };
    const report = evaluateSceneCollisions([blockingWardrobe]);
    assert.equal(report.hasIssues, true);
    assert.ok(report.blockedDoors.length > 0, 'Should flag blocked front door');
  });

  it('snaps values to grid and clamps out-of-bounds items back into the house footprint', () => {
    assert.equal(snapValueToGrid(1.23, 0.25), 1.25);
    assert.equal(snapValueToGrid(-3.44, 0.1), -3.4);

    const wayOutside: FurnitureItem = {
      id: 'outside_1',
      name: 'Chair',
      category: 'living',
      type: 'armchair',
      roomId: 'living',
      floor: 1,
      x: -25,
      y: -3,
      z: 30,
      width: 1.0,
      height: 0.9,
      depth: 1.0,
      rotationY: 0,
      color: '#cccccc',
      material: 'fabric',
    };
    const clamped = clampItemToHouseBounds(wayOutside);
    assert.ok(clamped.x >= -6.75 && clamped.x <= 6.75);
    assert.ok(clamped.z >= -4.75 && clamped.z <= 4.75);
    assert.equal(clamped.y, 0);
  });

  it('manages Undo / Redo history stack transitions accurately', () => {
    let stack = createHistoryStack(1);
    stack = pushHistoryState(stack, 2);
    stack = pushHistoryState(stack, 3);
    assert.equal(stack.present, 3);

    stack = undoHistoryState(stack);
    assert.equal(stack.present, 2);

    stack = undoHistoryState(stack);
    assert.equal(stack.present, 1);

    stack = redoHistoryState(stack);
    assert.equal(stack.present, 2);
  });

  it('defines true 4K UHD export dimensions (3840x2160) and complete room bounds', () => {
    assert.equal(UHD_4K_DIMENSIONS.width, 3840);
    assert.equal(UHD_4K_DIMENSIONS.height, 2160);
    assert.ok(HOUSE_ROOMS.living.areaSqm > 50);
    assert.ok(HOUSE_ROOMS.bedroom.floor === 2);
  });
});
