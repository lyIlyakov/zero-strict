import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOMS,
  SPAWN_POINTS,
  TERMINALS,
  WALL_SEGMENTS,
  getRoomAt,
  hasLineOfSight,
  isPointWalkable,
  resolvePlayerMovement,
} from './mapData';
import { TASK_CATALOG, generateTaskChallenge } from './tasks';

test('station layout contains all 9 required rooms and perimeter walls', () => {
  assert.equal(ROOMS.length, 9);
  assert.ok(WALL_SEGMENTS.length > 20, 'perimeter wall compiler must produce walls');

  for (const sp of SPAWN_POINTS) {
    assert.equal(isPointWalkable(sp.x, sp.z), true, `spawn (${sp.x}, ${sp.z}) must be walkable`);
    assert.equal(getRoomAt(sp.x, sp.z), 'command');
  }
});

test('all 9 rooms and all 26 terminals are reachable from Command Hall via BFS', () => {
  const step = 1.0;
  const key = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
  const start = { x: 0, z: 3 };
  assert.equal(isPointWalkable(start.x, start.z), true);

  const visited = new Set<string>([key(start.x, start.z)]);
  const queue: Array<{ x: number; z: number }> = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbors = [
      { x: cur.x + step, z: cur.z },
      { x: cur.x - step, z: cur.z },
      { x: cur.x, z: cur.z + step },
      { x: cur.x, z: cur.z - step },
    ];
    for (const n of neighbors) {
      const k = key(n.x, n.z);
      if (visited.has(k)) continue;
      if (isPointWalkable(n.x, n.z, 0.35)) {
        visited.add(k);
        queue.push(n);
      }
    }
  }

  for (const room of ROOMS) {
    const reachedRoom = [...visited].some((k) => {
      const [x, z] = k.split(',').map(Number);
      return getRoomAt(x, z) === room.id;
    });
    assert.equal(reachedRoom, true, `Room ${room.id} must be reachable from Command Hall`);
  }

  for (const term of TERMINALS) {
    const nearReachable = [...visited].some((k) => {
      const [x, z] = k.split(',').map(Number);
      return Math.hypot(x - term.x, z - term.z) <= 2.4;
    });
    assert.equal(nearReachable, true, `Terminal ${term.id} (${term.roomId}) must be reachable`);
  }
});

test('collisions block walking through station outer walls and obstacles', () => {
  // Attempt to walk out of Command Hall through solid north-east wall at x=4, z=-5
  const res = resolvePlayerMovement(4, -3.5, 4, -8);
  assert.ok(res.z >= -4.6, `Player should stop before wall z=-5, got z=${res.z}`);
});

test('line of sight blocks vision through solid walls and reactor core', () => {
  // Clear LOS inside Command Hall corridor
  assert.equal(hasLineOfSight(-4, 3, 4, 3), true);
  // Blocked across outer void between Command Hall (4,-3) and Navigation (16,-16)
  assert.equal(hasLineOfSight(4, -3, 16, -16), false);
  // Blocked across Reactor Core obstacle at (-30, 0)
  assert.equal(hasLineOfSight(-33, 0, -27, 0), false);
});

test('task catalog defines all 18 tasks (2 common, 10 short, 6 long) on valid terminals', () => {
  assert.equal(TASK_CATALOG.length, 18);
  assert.equal(TASK_CATALOG.filter((t) => t.category === 'common').length, 2);
  assert.equal(TASK_CATALOG.filter((t) => t.category === 'short').length, 10);
  assert.equal(TASK_CATALOG.filter((t) => t.category === 'long').length, 6);

  const termIds = new Set(TERMINALS.map((t) => t.id));
  for (const task of TASK_CATALOG) {
    assert.ok(task.stages.length >= 1);
    for (let i = 0; i < task.stages.length; i++) {
      const stage = task.stages[i];
      assert.ok(termIds.has(stage.terminalId), `Terminal ${stage.terminalId} missing for ${task.id}`);
      const challenge = generateTaskChallenge(task.id, i, () => 0.42, 1000);
      assert.equal(challenge.taskId, task.id);
      assert.equal(challenge.stageIndex, i);
    }
  }
});
