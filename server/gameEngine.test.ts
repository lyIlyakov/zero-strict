import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_KILL_COOLDOWN_MS,
  KILL_COOLDOWN_MS,
  MEETING_RESULT_DELAY_MS,
  RECONNECT_WINDOW_MS,
  RoomGameEngine,
  SHIELD_DURATION_MS,
} from './gameEngine';
import { TERMINAL_BY_ID } from '../shared/mapData';
import type { ServerChallengeRecord } from '../shared/tasks';

function buildCorrectAnswer(challenge: ServerChallengeRecord): Record<string, unknown> {
  const { taskId, stageIndex, secret } = challenge;
  switch (taskId) {
    case 'sync_pass':
      return { selected: secret.expected };
    case 'rewire_line':
      return { connections: secret.expectedMap };
    case 'tune_antenna':
      return { freq: secret.targetFreq, phase: secret.targetPhase };
    case 'replace_fuses':
      return { placed: secret.expectedSlots };
    case 'clean_filter':
      return { clearedCount: secret.totalDebris, minAirflow: 80 };
    case 'balance_pressure':
      return {
        holdMs: Number(secret.requiredHoldMs) + 100,
        lastValue: (Number(secret.targetMin) + Number(secret.targetMax)) / 2,
      };
    case 'check_batteries':
      return { sorted: secret.expected };
    case 'reroute_power':
      return { rotations: [1, 0, 2, 3, 2, 0, 1, 0, 0] };
    case 'calibrate_gyro':
      return { holdMs: Number(secret.requiredHoldMs) + 100 };
    case 'unload_container':
      return { assignments: secret.expected };
    case 'calibrate_shield':
      return { sequence: secret.sequence };
    case 'find_leak':
      return { valveId: secret.leakId };
    case 'transmit_telemetry':
      return stageIndex === 0
        ? { lockedIds: secret.markerIds }
        : { packetCode: secret.packetCode, azimuth: secret.targetAzimuth };
    case 'analyze_sample':
      return stageIndex === 0
        ? { reagentCode: secret.reagentCode }
        : { sampleId: secret.anomalyId };
    case 'start_backup_loop':
      return stageIndex === 0
        ? { serial: secret.targetSerial }
        : { values: secret.targets };
    case 'inspect_suit':
      return stageIndex === 0
        ? { sealId: secret.expectedId }
        : { checked: secret.steps };
    case 'restore_irrigation':
      return stageIndex === 0
        ? { rpm: secret.targetRpm }
        : { lines: secret.lineTargets };
    case 'update_station_route':
      return stageIndex === 0
        ? {
            path: [
              [0, 0],
              [0, 1],
              [0, 2],
              [1, 2],
              [2, 2],
              [2, 3],
              [2, 4],
              [3, 4],
              [4, 4],
            ],
          }
        : { routeCode: secret.routeCode };
  }
}

function completeOneTaskForPlayer(
  engine: RoomGameEngine,
  playerId: string,
  taskIndex: number,
  advanceClock: (ms: number) => void,
): void {
  const snap = engine.getSnapshotForPlayer(playerId)!;
  const task = snap.self.tasks[taskIndex];
  for (let s = task.currentStageIndex; s < task.stages.length; s++) {
    const freshSnap = engine.getSnapshotForPlayer(playerId)!;
    const freshStage = freshSnap.self.tasks[taskIndex].stages[s];
    if (freshStage.readyAt && freshStage.readyAt > freshSnap.serverTime) {
      advanceClock(freshStage.readyAt - freshSnap.serverTime + 50);
    }
    const term = TERMINAL_BY_ID[freshStage.terminalId];
    engine.setPlayerPositionForTest(playerId, term.x, term.z);
    const openRes = engine.openTask(playerId, task.taskId, freshStage.terminalId);
    assert.equal(openRes.ok, true, `openTask failed for ${task.taskId} stage ${s}: ${openRes.error}`);
    const challenge = engine.getDebugActiveChallenge(playerId)!;
    const answer = buildCorrectAnswer(challenge);
    const subRes = engine.submitTask(playerId, task.taskId, s, answer);
    assert.equal(subRes.ok, true, `submitTask failed for ${task.taskId} stage ${s}: ${subRes.error}`);
  }
}

function create4PlayerMatch(forcedSaboteurIndex = 0, settings?: import('../shared/types').RoomSettings) {
  let time = 100_000;
  let seed = 1;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const engine = new RoomGameEngine('TEST01', {
    now: () => time,
    rng,
  });
  const advance = (ms: number) => {
    time += ms;
    engine.tick(time);
  };

  const p1 = engine.addPlayer('Алекс', 's1');
  const p2 = engine.addPlayer('Борис', 's2');
  const p3 = engine.addPlayer('Вера', 's3');
  const p4 = engine.addPlayer('Глеб', 's4');
  assert.equal(p1.ok && p2.ok && p3.ok && p4.ok, true);

  if (settings) assert.equal(engine.updateSettings(p1.playerId!, settings).ok, true);
  const start = engine.startMatch(p1.playerId!, forcedSaboteurIndex);
  assert.equal(start.ok, true);

  return {
    engine,
    ids: [p1.playerId!, p2.playerId!, p3.playerId!, p4.playerId!],
    tokens: [p1.sessionToken!, p2.sessionToken!, p3.sessionToken!, p4.sessionToken!],
    advance,
    getTime: () => time,
    advanceWithoutTick: (ms: number) => { time += ms; },
  };
}

test('lobby movement is shared, time-bounded and confined to the command hall', () => {
  let time = 100_000;
  const engine = new RoomGameEngine('LOBBY1', { now: () => time });
  const host = engine.addPlayer('Алекс', 's1').playerId!;
  const guest = engine.addPlayer('Вера', 's2').playerId!;
  const position = () => engine.getSnapshotForPlayer(guest)!.players.find((p) => p.id === host)!;

  time += 100;
  assert.equal(engine.movePlayer(host, 0, 3.5, 0.5), true);
  assert.equal(position().z, 3.5);
  assert.equal(position().yaw, 0.5);
  for (let i = 0; i < 100; i++) engine.movePlayer(host, 0, 100, 0.5);
  assert.ok(position().z < 4.4, 'same-timestamp packets cannot create extra movement credit');

  for (let i = 0; i < 30; i++) {
    time += 100;
    engine.movePlayer(host, 0, 100, 0.5);
  }
  assert.equal(position().z, 5.5, 'stop at the closed passage');
  for (const x of [100, -100]) {
    for (let i = 0; i < 30; i++) {
      time += 100;
      engine.movePlayer(host, x, 4.6, 0.5);
    }
    assert.ok(Math.abs(position().x) <= 5.5 && Math.abs(position().z) <= 5.5);
  }
  const before = position();
  assert.equal(engine.movePlayer(host, NaN, 0, 0), false);
  assert.deepEqual(position(), before);
  engine.markDisconnected(host);
  assert.equal(engine.movePlayer(host, 0, 3.1, 0), false);
});

test('room rules are host-only, validated atomically and enforce reserved capacity', () => {
  const engine = new RoomGameEngine('RULES1');
  const host = engine.addPlayer('Алекс', 's1').playerId!;
  const guest = engine.addPlayer('Вера', 's2').playerId!;
  const rules = () => engine.getSnapshotForPlayer(guest)!.settings;
  const defaults = { maxPlayers: 8, meetingSeconds: 60, killCooldownSeconds: 22, emergencyEnabled: true };
  assert.deepEqual(rules(), defaults);
  assert.equal(engine.updateSettings(guest, { maxPlayers: 4 }).ok, false);
  assert.equal(engine.updateSettings(host, { maxPlayers: 4, meetingSeconds: 45 }).ok, true);
  const updated = { ...defaults, maxPlayers: 4, meetingSeconds: 45 };
  assert.deepEqual(rules(), updated);
  for (const invalid of [null, [], {}, { unknown: true }, { maxPlayers: 1 }, { maxPlayers: 13 },
    { meetingSeconds: 29, emergencyEnabled: false }, { meetingSeconds: 121 },
    { killCooldownSeconds: 10.5 }, { killCooldownSeconds: 61 }, { emergencyEnabled: 'false' }]) {
    assert.equal(engine.updateSettings(host, invalid).ok, false);
    assert.deepEqual(rules(), updated);
  }
  engine.addPlayer('Борис', 's3');
  const away = engine.addPlayer('Глеб', 's4').playerId!;
  engine.markDisconnected(away);
  assert.equal(engine.addPlayer('Дина', 's5').ok, false);
  assert.equal(engine.updateSettings(host, { maxPlayers: 5 }).ok, true);
  assert.equal(engine.addPlayer('Дина', 's5').ok, true);
  assert.equal(engine.updateSettings(host, { maxPlayers: 4 }).ok, false, 'cannot evict a reserved place');
  assert.equal(engine.startMatch(host).ok, true);
  assert.equal(engine.updateSettings(host, { meetingSeconds: 60 }).ok, false);
  assert.deepEqual(rules(), { ...updated, maxPlayers: 5 });
});

test('room capacity supports the confirmed 2–12 player range', () => {
  const twoPlayerRoom = new RoomGameEngine('CAPACITY2');
  const twoPlayerHost = twoPlayerRoom.addPlayer('Алекс', 's1').playerId!;
  twoPlayerRoom.addPlayer('Вера', 's2');
  assert.equal(twoPlayerRoom.updateSettings(twoPlayerHost, { maxPlayers: 2 }).ok, true);
  assert.equal(twoPlayerRoom.startMatch(twoPlayerHost).ok, true);

  const engine = new RoomGameEngine('CAPACITY1');
  const host = engine.addPlayer('Алекс', 's1').playerId!;
  const guest = engine.addPlayer('Вера', 's2').playerId!;
  const settings = () => engine.getSnapshotForPlayer(host)!.settings;

  assert.equal(engine.updateSettings(host, { maxPlayers: 2 }).ok, true);
  assert.equal(settings().maxPlayers, 2);
  assert.equal(engine.addPlayer('Борис', 's3').ok, false);
  assert.equal(engine.updateSettings(host, { maxPlayers: 1 }).ok, false);
  assert.equal(engine.updateSettings(host, { maxPlayers: 12 }).ok, true);
  assert.equal(settings().maxPlayers, 12);
  for (let index = 0; index < 10; index++) {
    assert.equal(engine.addPlayer(`Игрок ${index}`, `s${index + 3}`).ok, true);
  }
  assert.equal(engine.addPlayer('Ещё игрок', 's13').ok, false);
  assert.equal(engine.updateSettings(host, { maxPlayers: 13 }).ok, false);
  assert.equal(settings().maxPlayers, 12);
  assert.equal(engine.getSnapshotForPlayer(guest)!.settings.maxPlayers, 12);
});

test('suit selection is public, survives reconnect and rematch, and locks during play', () => {
  const engine = new RoomGameEngine('SUITS1');
  const host = engine.addPlayer('Алекс', 's1');
  const hostId = host.playerId!;
  const guest = engine.addPlayer('Вера', 's2').playerId!;
  const suit = () => engine.getSnapshotForPlayer(guest)!.players.find((p) => p.id === hostId)!.skin;
  assert.equal(suit(), 'standard');
  assert.equal(engine.selectSkin(hostId, 'engineer').ok, false);
  assert.equal(engine.selectSkin(hostId, 'survey').ok, true);
  assert.equal(suit(), 'survey');
  engine.markDisconnected(hostId);
  assert.equal(engine.selectSkin(hostId, 'medic').ok, false);
  assert.equal(engine.reconnectPlayer(host.sessionToken!, 's1_new').ok, true);
  assert.equal(suit(), 'survey');
  engine.addPlayer('Борис', 's3');
  engine.addPlayer('Глеб', 's4');
  assert.equal(engine.startMatch(guest, 1).ok, true);
  assert.equal(engine.selectSkin(hostId, 'salvage').ok, false);
  engine.leaveExplicitly(guest); // First in order is still the original host; index 1 is the new host.
  assert.equal(engine.returnToLobby(hostId).ok, true);
  assert.equal(suitAfterRematch(), 'survey');

  function suitAfterRematch() {
    return engine.getSnapshotForPlayer(hostId)!.players.find((p) => p.id === hostId)!.skin;
  }
});

test('configured cooldown and voting duration apply in play without disabling body reports', () => {
  const { engine, ids: [saboteur, target, caller], advance, getTime } = create4PlayerMatch(0, {
    maxPlayers: 4, meetingSeconds: 37, killCooldownSeconds: 31, emergencyEnabled: false,
  });
  advance(20_000);
  // Command's lower passage: walk up to the table and test the disabled call within range.
  assert.equal(engine.movePlayer(caller, 1.8, 0, 0), true);
  assert.match(engine.callEmergencyMeeting(caller).error ?? '', /отключён/);
  for (const [id, x, z] of [[saboteur, 0, 3.1], [target, 1, 3.1], [caller, 2, 3.1]] as const) {
    for (let i = 0; i < 8; i++) {
      advance(250);
      const p = engine.getSnapshotForPlayer(id)!.players.find((player) => player.id === id)!;
      const nextX = p.z < 2.2 ? 2.8 : x;
      assert.equal(engine.movePlayer(id, nextX, z, 0), true);
    }
  }
  assert.equal(engine.attackPlayer(saboteur, target).ok, true);
  assert.equal(engine.getSnapshotForPlayer(saboteur)!.self.killCooldownUntil - getTime(), 31_000);
  assert.equal(engine.reportBody(caller).ok, true);
  const meeting = engine.getSnapshotForPlayer(caller)!.meeting!;
  assert.equal(meeting.reason, 'body');
  assert.equal(meeting.endsAt - meeting.startedAt, 37_000);
  advance(36_999);
  assert.equal(engine.getSnapshotForPlayer(caller)!.meeting!.result, null);
  advance(1);
  assert.equal(engine.getSnapshotForPlayer(caller)!.meeting!.result?.outcome, 'skipped');
});

test('4-player shield stays locked below 50% tasks and unlocks at exact 50% without eliminations', () => {
  // 3 crew * 5 tasks = 15 initialTotalCrewTasks -> 50% threshold is 8 tasks (7*2=14 < 15; 8*2=16 >= 15)
  const { engine, ids, advance } = create4PlayerMatch(0);
  const crewIds = ids.slice(1);

  const initialSnap = engine.getSnapshotForPlayer(crewIds[0])!;
  assert.equal(initialSnap.initialTotalCrewTasks, 15);
  assert.equal(initialSnap.shieldUnlocked, false);
  assert.equal(initialSnap.activePlayersCount, 4);

  // Complete 7 tasks across crew
  for (let i = 0; i < 5; i++) completeOneTaskForPlayer(engine, crewIds[0], i, advance);
  for (let i = 0; i < 2; i++) completeOneTaskForPlayer(engine, crewIds[1], i, advance);

  const snap7 = engine.getSnapshotForPlayer(crewIds[1])!;
  assert.equal(snap7.completedCrewTasks, 7);
  assert.equal(snap7.shieldUnlocked, false, 'Shield must remain locked at 7/15 (<50%)');

  // Completing 8th task unlocks shield with reason tasks_50
  completeOneTaskForPlayer(engine, crewIds[1], 2, advance);
  const snap8 = engine.getSnapshotForPlayer(crewIds[1])!;
  assert.equal(snap8.completedCrewTasks, 8);
  assert.equal(snap8.shieldUnlocked, true, 'Shield must unlock at 8/15 (>=50%)');
  assert.equal(snap8.shieldUnlockReason, 'tasks_50');
  assert.equal(snap8.activePlayersCount, 4);
});

test('shield unlocks when progress < 50% and active players drop to 3 (2 crew + 1 saboteur)', () => {
  const { engine, ids, advance } = create4PlayerMatch(0);
  const [sabId, c1, c2, c3] = ids;

  advance(INITIAL_KILL_COOLDOWN_MS + 500);
  engine.setPlayerPositionForTest(sabId, 0, 3);
  engine.setPlayerPositionForTest(c1, 1.0, 3);

  const atk = engine.attackPlayer(sabId, c1);
  assert.equal(atk.ok, true);
  assert.equal(atk.blockedByShield, false);

  const snap = engine.getSnapshotForPlayer(c2)!;
  assert.equal(snap.phase, 'playing');
  assert.equal(snap.activePlayersCount, 3);
  assert.equal(snap.completedCrewTasks, 0);
  assert.equal(snap.shieldUnlocked, true);
  assert.equal(snap.shieldUnlockReason, 'players_3');

  // Verify saboteur has 0 shield charge and cannot activate shield
  assert.equal(engine.getSnapshotForPlayer(sabId)!.self.shieldCharge, 0);
  assert.equal(engine.activateShield(sabId).ok, false);
  // Alive crew c2 and c3 each have 1 charge
  assert.equal(engine.getSnapshotForPlayer(c2)!.self.shieldCharge, 1);
  assert.equal(engine.getSnapshotForPlayer(c3)!.self.shieldCharge, 1);
});

test('shield blocks attack inside 2s window, fails after expiry, cannot be used twice, slows saboteur', () => {
  const { engine, ids, advance } = create4PlayerMatch(0);
  const [sabId, c1, c2] = ids;

  // Eliminate c1 to unlock shield via condition B (3 active players)
  advance(INITIAL_KILL_COOLDOWN_MS + 500);
  engine.setPlayerPositionForTest(sabId, 0, 3);
  engine.setPlayerPositionForTest(c1, 1, 3);
  assert.equal(engine.attackPlayer(sabId, c1).ok, true);

  // Wait for saboteur kill cooldown
  advance(KILL_COOLDOWN_MS + 500);
  engine.setPlayerPositionForTest(sabId, 0, 3);
  engine.setPlayerPositionForTest(c2, 1, 3);

  // c2 activates shield -> charge immediately drops to 0 and second activation is rejected
  assert.equal(engine.activateShield(c2).ok, true);
  assert.equal(engine.getSnapshotForPlayer(c2)!.self.shieldCharge, 0);
  assert.equal(engine.activateShield(c2).ok, false, 'Shield cannot be consumed twice');

  // Saboteur attacks within 2s window -> blocked, normal cooldown starts, saboteur slowed 3s
  advance(800);
  const blockedAtk = engine.attackPlayer(sabId, c2);
  assert.equal(blockedAtk.ok, true);
  assert.equal(blockedAtk.blockedByShield, true);
  assert.equal(engine.getSnapshotForPlayer(c2)!.players.find((p) => p.id === c2)!.status, 'alive');
  const sabSnap = engine.getSnapshotForPlayer(sabId)!;
  assert.ok(sabSnap.self.slowedUntil > sabSnap.serverTime, 'Saboteur must be slowed for 3s');
  assert.ok(sabSnap.self.killCooldownUntil > sabSnap.serverTime, 'Normal attack cooldown must trigger');

  // After shield expires and cooldown resets, attack succeeds
  advance(SHIELD_DURATION_MS + KILL_COOLDOWN_MS + 500);
  engine.setPlayerPositionForTest(sabId, 0, 3);
  engine.setPlayerPositionForTest(c2, 1, 3);
  const fatalAtk = engine.attackPlayer(sabId, c2);
  assert.equal(fatalAtk.ok, true);
  assert.equal(fatalAtk.blockedByShield, false);
  // 1 crew vs 1 saboteur -> saboteur wins!
  assert.equal(engine.phase, 'ended');
  assert.equal(engine.getSnapshotForPlayer(sabId)!.matchEnd?.winner, 'saboteur');
});

test('multi-stage long task counts exactly once, only after final stage, and rejects replay', () => {
  const { engine, ids, advance } = create4PlayerMatch(0);
  const crewId = ids[1];
  const snap = engine.getSnapshotForPlayer(crewId)!;
  const longTaskIdx = snap.self.tasks.findIndex((t) => t.category === 'long');
  assert.ok(longTaskIdx >= 0);
  const longTask = snap.self.tasks[longTaskIdx];
  assert.equal(longTask.stages.length, 2);

  // Stage 0
  const term0 = TERMINAL_BY_ID[longTask.stages[0].terminalId];
  engine.setPlayerPositionForTest(crewId, term0.x, term0.z);
  assert.equal(engine.openTask(crewId, longTask.taskId, term0.id).ok, true);
  const ch0 = engine.getDebugActiveChallenge(crewId)!;
  const res0 = engine.submitTask(crewId, longTask.taskId, 0, buildCorrectAnswer(ch0));
  assert.equal(res0.ok, true);
  assert.equal(res0.taskCompleted, false);
  assert.equal(engine.getSnapshotForPlayer(crewId)!.completedCrewTasks, 0, 'Stage 0 must NOT increment global progress');

  // Stage 1 (advance if analyze_sample wait timer is present)
  const midSnap = engine.getSnapshotForPlayer(crewId)!;
  const stage1 = midSnap.self.tasks[longTaskIdx].stages[1];
  if (stage1.readyAt) {
    // Trying before timer expires must fail
    const term1 = TERMINAL_BY_ID[stage1.terminalId];
    engine.setPlayerPositionForTest(crewId, term1.x, term1.z);
    assert.equal(engine.openTask(crewId, longTask.taskId, term1.id).ok, false);
    advance(stage1.readyAt - midSnap.serverTime + 100);
  }

  const term1 = TERMINAL_BY_ID[stage1.terminalId];
  engine.setPlayerPositionForTest(crewId, term1.x, term1.z);
  assert.equal(engine.openTask(crewId, longTask.taskId, term1.id).ok, true);
  const ch1 = engine.getDebugActiveChallenge(crewId)!;
  const ans1 = buildCorrectAnswer(ch1);
  const res1 = engine.submitTask(crewId, longTask.taskId, 1, ans1);
  assert.equal(res1.ok, true);
  assert.equal(res1.taskCompleted, true);
  assert.equal(engine.getSnapshotForPlayer(crewId)!.completedCrewTasks, 1);

  // Re-submitting same task must be rejected and not double-count
  assert.equal(engine.submitTask(crewId, longTask.taskId, 1, ans1).ok, false);
  assert.equal(engine.getSnapshotForPlayer(crewId)!.completedCrewTasks, 1);
});

test('по истечении времени голос и чат закрыты даже до следующей обработки таймера', () => {
  const { engine, ids: [a, b], advanceWithoutTick, getTime } = create4PlayerMatch();
  engine.setPlayerPositionForTest(b, 0, 0);
  assert.equal(engine.callEmergencyMeeting(b).ok, true);
  const meeting = () => engine.getSnapshotForPlayer(b)!.meeting!;
  advanceWithoutTick(meeting().endsAt - getTime() - 1);
  assert.equal(engine.sendMeetingChat(b, 'У шлюза').ok, true);
  assert.equal(engine.castVote(a, 'skip').ok, true);
  advanceWithoutTick(1);
  assert.equal(engine.castVote(b, a).ok, false);
  assert.equal(engine.sendMeetingChat(b, 'Поздно').ok, false);
  assert.equal(meeting().myVote, null);
  assert.equal(meeting().chat.length, 1);
});

test('meeting vote tie ejects nobody, double-vote rejected, reconnect within 30s works, rematch resets state', () => {
  const { engine, ids, tokens, advance } = create4PlayerMatch(0);
  const [p1, p2, p3, p4] = ids;

  // Call emergency meeting
  engine.setPlayerPositionForTest(p2, 0, 0);
  assert.equal(engine.callEmergencyMeeting(p2).ok, true);
  assert.equal(engine.phase, 'meeting');

  // 2 votes for p1, 2 votes for p3 -> tie!
  assert.equal(engine.castVote(p1, p3).ok, true);
  assert.equal(engine.castVote(p1, p3).ok, false, 'Duplicate vote must be rejected');
  assert.equal(engine.castVote(p2, p1).ok, true);
  assert.equal(engine.castVote(p3, p1).ok, true);
  assert.equal(engine.castVote(p4, p3).ok, true);

  const meetSnap = engine.getSnapshotForPlayer(p1)!;
  assert.equal(meetSnap.meeting?.result?.outcome, 'tie');
  assert.equal(meetSnap.meeting?.result?.ejectedPlayerId, null);

  advance(MEETING_RESULT_DELAY_MS + 100);
  assert.equal(engine.phase, 'playing');
  assert.equal(engine.getSnapshotForPlayer(p1)!.activePlayersCount, 4);

  // Disconnect p3 and reconnect within 30s
  engine.markDisconnected(p3);
  advance(15_000);
  const recon = engine.reconnectPlayer(tokens[2], 's3_new');
  assert.equal(recon.ok, true);
  assert.equal(recon.playerId, p3);
  assert.equal(engine.getSnapshotForPlayer(p3)!.players.find((p) => p.id === p3)!.connected, true);

  // Saboteur (p1) disconnects and does NOT return within 30s -> host transfers & crew wins with explicit reason
  engine.markDisconnected(p1);
  // Host immediately transferred
  assert.equal(engine.getSnapshotForPlayer(p2)!.players.find((p) => p.id === p2)!.isHost, true);
  advance(RECONNECT_WINDOW_MS + 500);
  assert.equal(engine.phase, 'ended');
  const endSnap = engine.getSnapshotForPlayer(p2)!;
  assert.equal(endSnap.matchEnd?.winner, 'crew');
  assert.equal(endSnap.matchEnd?.reasonCode, 'saboteur_disconnected');

  // Return to lobby & add a 4th player back to verify full reset in same room
  assert.equal(engine.returnToLobby(p2).ok, true);
  assert.equal(engine.phase, 'lobby');
  const p5 = engine.addPlayer('Дина', 's5');
  assert.equal(p5.ok, true);
  assert.equal(engine.startMatch(p2).ok, true);
  assert.equal(engine.roundNumber, 2);
  const r2Snap = engine.getSnapshotForPlayer(p2)!;
  assert.equal(r2Snap.completedCrewTasks, 0);
  assert.equal(r2Snap.shieldUnlocked, false);
  assert.equal(r2Snap.self.emergencyUsed, false);
});

test('crewmate permanent disconnect excludes unfinished tasks from win target but keeps shield 50% denominator fixed', () => {
  const { engine, ids, advance } = create4PlayerMatch(0);
  const [sabId, c1, c2, c3] = ids;
  // Initial: 3 crew * 5 = 15 tasks (both required and initialTotal = 15)
  assert.equal(engine.getSnapshotForPlayer(c1)!.initialTotalCrewTasks, 15);
  assert.equal(engine.getSnapshotForPlayer(c1)!.requiredCrewTasks, 15);

  // c3 disconnects permanently (5 unfinished tasks removed from requiredCrewTasks -> 10, but initialTotal stays 15!)
  engine.markDisconnected(c3);
  advance(RECONNECT_WINDOW_MS + 500);

  const snap = engine.getSnapshotForPlayer(c1)!;
  assert.equal(snap.requiredCrewTasks, 10);
  assert.equal(snap.initialTotalCrewTasks, 15);
  assert.equal(snap.completedCrewTasks, 0);
  // Active players dropped to 3 (sabId, c1, c2), so condition B unlocks shield
  assert.equal(snap.shieldUnlocked, true);
  assert.equal(snap.shieldUnlockReason, 'players_3');
  assert.ok(sabId);
});

test('blackout freezes Sensor Echo, blocks emergency button, but allows body report', () => {
  const { engine, ids, advance } = create4PlayerMatch(0);
  const [sabId, c1, c2] = ids;

  advance(20_000);
  assert.equal(engine.sabotageLights(sabId).ok, true);
  assert.equal(engine.getSnapshotForPlayer(c2)!.lightsOut, true);

  // Move c2 into Reactor during blackout -> Sensor Echo must NOT record Reactor
  engine.setPlayerPositionForTest(c2, -30, 4);
  engine.setPlayerPositionForTest(c2, 4.5, -4.2);
  const echoDuring = engine.readSensorEcho(c2);
  assert.equal(echoDuring.ok, true);
  assert.equal(echoDuring.snapshot?.pausedByBlackout, true);
  const reactorEntry = echoDuring.snapshot?.entries.find((e) => e.roomId === 'reactor');
  assert.equal(reactorEntry?.secondsAgo, null, 'Blackout must pause Sensor Echo updates');

  // Emergency button blocked during blackout
  engine.setPlayerPositionForTest(c2, 0, 0);
  assert.equal(engine.callEmergencyMeeting(c2).ok, false);

  // Saboteur eliminates c1 during blackout, c2 CAN still report body!
  engine.setPlayerPositionForTest(sabId, 0, 3);
  engine.setPlayerPositionForTest(c1, 1, 3);
  assert.equal(engine.attackPlayer(sabId, c1).ok, true);
  engine.setPlayerPositionForTest(c2, 2, 3);
  assert.equal(engine.reportBody(c2).ok, true);
  assert.equal(engine.phase, 'meeting');
});
