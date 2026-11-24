import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTouchControls } from './touchControls';

test('a movement finger and a look finger keep independent ownership through release', () => {
  const controls = createTouchControls();
  assert.equal(controls.start('move', 11, 10, 50), true);
  assert.equal(controls.start('look', 22, 210, 50), true);
  assert.equal(controls.start('look', 33, 220, 50), false);
  controls.move(11, 10, 2);
  controls.move(22, 218, 44);
  assert.deepEqual(controls.movement, { x: 0, z: 1 });
  assert.deepEqual(controls.takeLook(), { x: 8, y: -6 });
  assert.deepEqual(controls.takeLook(), { x: 0, y: 0 });
  controls.end(22);
  assert.deepEqual(controls.movement, { x: 0, z: 1 });
  controls.end(11);
  assert.deepEqual(controls.movement, { x: 0, z: 0 });
});

test('reset drops held movement, queued look, and events from the old fingers', () => {
  const controls = createTouchControls();
  controls.start('move', 3, 0, 0);
  controls.start('look', 8, 80, 0);
  controls.move(3, 0, -30);
  controls.move(8, 92, 6);
  controls.reset();
  controls.move(3, 0, -40);
  controls.move(8, 105, 8);
  assert.deepEqual(controls.movement, { x: 0, z: 0 });
  assert.deepEqual(controls.takeLook(), { x: 0, y: 0 });
  assert.equal(controls.start('move', 9, 0, 0), true);
});
