import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  RoomSnapshot,
  ServerToClientEvents,
} from '../shared/types';
import { RoomGameEngine } from './gameEngine';

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

function waitForCondition(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timed out waiting for socket condition'));
      }
      setTimeout(check, 25);
    };
    check();
  });
}

test('production sockets publish lobby movement, suits and validated rules', { timeout: 8000 }, async (t) => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stopped = once(child, 'close');
  const clients: TestClient[] = [];
  t.after(async () => {
    clients.forEach((client) => client.disconnect());
    child.kill();
    await stopped;
  });
  const lines = createInterface({ input: child.stdout });
  const port = await new Promise<number>((resolve, reject) => {
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', () => reject(new Error(`Lobby server stopped: ${stderr}`)));
    lines.on('line', (line) => {
      const match = line.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
  });
  assert.ok(port > 0, 'server exposes bound port for local socket tests');
  const snapshots: RoomSnapshot[] = [];
  for (let i = 0; i < 3; i++) {
    const client: TestClient = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    clients.push(client);
    client.on('room:snapshot', (snapshot) => { snapshots[i] = snapshot; });
  }
  await waitForCondition(() => clients.every((client) => client.connected));
  const [host, guest, replacement] = clients;
  const created = await host.timeout(1000).emitWithAck('room:create', { name: 'Алекс' });
  assert.equal(created.ok, true);
  const roomCode = created.roomCode!;
  assert.equal((await guest.timeout(1000).emitWithAck('room:join', { roomCode, name: 'Вера' })).ok, true);
  assert.equal((await guest.timeout(1000).emitWithAck('room:settings', { maxPlayers: 4 })).ok, false);
  assert.equal((await host.timeout(1000).emitWithAck('room:settings', { maxPlayers: 4, meetingSeconds: 48 })).ok, true);
  assert.equal((await host.timeout(1000).emitWithAck('room:skin', { skin: 'salvage' })).ok, true);
  assert.equal((await host.timeout(1000).emitWithAck('room:skin', null as never)).ok, false);
  assert.equal((await host.timeout(1000).emitWithAck('room:settings', { emergencyEnabled: 'no' } as never)).ok, false);
  await waitForCondition(() => snapshots[1]?.settings.meetingSeconds === 48 &&
    snapshots[1].players.find((p) => p.id === created.playerId)?.skin === 'salvage');

  const moved = new Promise<Parameters<ServerToClientEvents['player:moved']>[0]>((resolve) =>
    guest.once('player:moved', resolve),
  );
  host.emit('player:move', { x: 0, z: 3.2, yaw: 0.25 });
  const pose = await moved;
  assert.equal(pose.playerId, created.playerId);
  assert.ok(pose.z > 3.1 && pose.z <= 3.2);
  assert.equal(pose.yaw, 0.25);

  assert.equal((await replacement.timeout(1000).emitWithAck('room:reconnect', { roomCode, sessionToken: created.sessionToken! })).ok, true);
  assert.equal((await host.timeout(1000).emitWithAck('room:settings', { maxPlayers: 8 })).ok, false);
  assert.equal((await host.timeout(1000).emitWithAck('room:skin', { skin: 'medic' })).ok, false);
  host.disconnect();
  assert.equal((await replacement.timeout(1000).emitWithAck('room:settings', { maxPlayers: 5 })).ok, true);
  await waitForCondition(() => snapshots[1]?.settings.maxPlayers === 5);
});

test('4 independent Socket.IO clients join by room code, verify private roles, vote out saboteur, and rematch in same lobby', async () => {
  const httpServer = http.createServer();
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer);
  const rooms = new Map<string, RoomGameEngine>();
  const sessions = new Map<string, { roomCode: string; playerId: string }>();

  const broadcast = (code: string) => {
    const engine = rooms.get(code);
    if (!engine) return;
    for (const pid of engine.getPlayerIds()) {
      const sid = engine.getSocketIdForPlayer(pid);
      if (!sid) continue;
      const snap = engine.getSnapshotForPlayer(pid);
      if (snap) io.to(sid).emit('room:snapshot', snap);
    }
  };

  io.on('connection', (socket) => {
    socket.on('room:create', ({ name }, cb) => {
      const code = 'INT999';
      const engine = new RoomGameEngine(code, {
        callbacks: { onStateChange: (c) => broadcast(c) },
      });
      rooms.set(code, engine);
      const res = engine.addPlayer(name, socket.id);
      socket.join(code);
      sessions.set(socket.id, { roomCode: code, playerId: res.playerId! });
      cb({ ok: true, roomCode: code, playerId: res.playerId, sessionToken: res.sessionToken });
      broadcast(code);
    });

    socket.on('room:join', ({ roomCode, name }, cb) => {
      const engine = rooms.get(roomCode);
      if (!engine) return cb({ ok: false, error: 'not found' });
      const res = engine.addPlayer(name, socket.id);
      socket.join(roomCode);
      sessions.set(socket.id, { roomCode, playerId: res.playerId! });
      cb({ ok: true, roomCode, playerId: res.playerId, sessionToken: res.sessionToken });
      broadcast(roomCode);
    });

    socket.on('game:start', (cb) => {
      const s = sessions.get(socket.id)!;
      cb(rooms.get(s.roomCode)!.startMatch(s.playerId));
    });

    socket.on('meeting:callEmergency', (cb) => {
      const s = sessions.get(socket.id)!;
      const engine = rooms.get(s.roomCode)!;
      engine.setPlayerPositionForTest(s.playerId, 0, 0);
      cb(engine.callEmergencyMeeting(s.playerId));
    });

    socket.on('meeting:vote', ({ targetId }, cb) => {
      const s = sessions.get(socket.id)!;
      cb(rooms.get(s.roomCode)!.castVote(s.playerId, targetId));
    });

    socket.on('game:returnToLobby', (cb) => {
      const s = sessions.get(socket.id)!;
      cb(rooms.get(s.roomCode)!.returnToLobby(s.playerId));
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const addr = httpServer.address();
  assert.ok(addr && typeof addr !== 'string');
  const url = `http://127.0.0.1:${addr.port}`;

  const clients: TestClient[] = [];
  const snapshots: Array<RoomSnapshot | null> = [null, null, null, null];

  try {
    for (let i = 0; i < 4; i++) {
      const c: TestClient = ioClient(url, { transports: ['websocket'] });
      c.on('room:snapshot', (snap) => {
        snapshots[i] = snap;
      });
      clients.push(c);
    }

    await waitForCondition(() => clients.every((c) => c.connected));

    // Client 0 creates room, Clients 1..3 join by code
    const createRes = await new Promise<{ ok: boolean; roomCode?: string }>((resolve) =>
      clients[0].emit('room:create', { name: 'Игрок 1' }, resolve),
    );
    assert.equal(createRes.ok, true);
    const code = createRes.roomCode!;

    for (let i = 1; i < 4; i++) {
      const joinRes = await new Promise<{ ok: boolean }>((resolve) =>
        clients[i].emit('room:join', { roomCode: code, name: `Игрок ${i + 1}` }, resolve),
      );
      assert.equal(joinRes.ok, true);
    }

    await waitForCondition(() => snapshots.every((s) => s?.players.length === 4));

    // Host starts match
    const startRes = await new Promise<{ ok: boolean }>((resolve) =>
      clients[0].emit('game:start', resolve),
    );
    assert.equal(startRes.ok, true);

    await waitForCondition(() => snapshots.every((s) => s?.phase === 'playing'));

    // Exactly 1 saboteur and 3 crew; nobody sees other players' roles during match
    const roles = snapshots.map((s) => s!.self.role);
    assert.equal(roles.filter((r) => r === 'saboteur').length, 1);
    assert.equal(roles.filter((r) => r === 'crew').length, 3);
    for (const s of snapshots) {
      assert.equal(s!.players.every((p) => p.revealedRole === undefined), true);
    }

    // Find saboteur ID and call emergency meeting to vote them out
    const sabIdx = roles.indexOf('saboteur');
    const sabId = snapshots[sabIdx]!.self.playerId;
    const callerIdx = (sabIdx + 1) % 4;

    const callRes = await new Promise<{ ok: boolean }>((resolve) =>
      clients[callerIdx].emit('meeting:callEmergency', resolve),
    );
    assert.equal(callRes.ok, true);
    await waitForCondition(() => snapshots.every((s) => s?.phase === 'meeting'));

    // All 3 crew vote out saboteur, saboteur skips
    for (let i = 0; i < 4; i++) {
      const target = i === sabIdx ? 'skip' : sabId;
      const vRes = await new Promise<{ ok: boolean }>((resolve) =>
        clients[i].emit('meeting:vote', { targetId: target }, resolve),
      );
      assert.equal(vRes.ok, true);
    }

    // Advance meeting resolution timer on engine
    const engine = rooms.get(code)!;
    await waitForCondition(() => snapshots[0]?.meeting?.result?.outcome === 'ejected');
    engine.tick(Date.now() + 10_000);

    await waitForCondition(() => snapshots.every((s) => s?.phase === 'ended'));
    assert.equal(snapshots[0]!.matchEnd?.winner, 'crew');
    assert.equal(snapshots[0]!.matchEnd?.reasonCode, 'saboteur_ejected');

    // Return to same lobby & launch round 2 cleanly
    const backRes = await new Promise<{ ok: boolean }>((resolve) =>
      clients[0].emit('game:returnToLobby', resolve),
    );
    assert.equal(backRes.ok, true);
    await waitForCondition(() => snapshots.every((s) => s?.phase === 'lobby'));

    const start2Res = await new Promise<{ ok: boolean }>((resolve) =>
      clients[0].emit('game:start', resolve),
    );
    assert.equal(start2Res.ok, true);
    await waitForCondition(() => snapshots.every((s) => s?.phase === 'playing' && s.roundNumber === 2));
  } finally {
    clients.forEach((c) => c.disconnect());
    io.close();
    httpServer.close();
  }
});
