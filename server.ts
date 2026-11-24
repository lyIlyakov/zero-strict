import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from './shared/types';
import { RoomGameEngine } from './server/gameEngine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface SocketSession {
  roomCode: string;
  playerId: string;
}

const rooms = new Map<string, RoomGameEngine>();
const socketSessions = new Map<string, SocketSession>();

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Same-origin or explicit non-wildcard local dev / configured APP_URL
        if (!origin) return callback(null, true);
        const allowed = new Set<string>([
          `http://localhost:${PORT}`,
          `http://127.0.0.1:${PORT}`,
        ]);
        if (process.env.APP_URL) allowed.add(process.env.APP_URL);
        if (allowed.has(origin) || origin.endsWith('.run.app')) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed'), false);
      },
      credentials: false,
    },
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  function broadcastRoomSnapshot(roomCode: string): void {
    const engine = rooms.get(roomCode);
    if (!engine) return;
    for (const playerId of engine.getPlayerIds()) {
      const sockId = engine.getSocketIdForPlayer(playerId);
      if (!sockId) continue;
      const snap = engine.getSnapshotForPlayer(playerId);
      if (snap) {
        io.to(sockId).emit('room:snapshot', snap);
      }
    }
    if (engine.isEmpty()) {
      rooms.delete(roomCode);
    }
  }

  function createEngine(code: string): RoomGameEngine {
    return new RoomGameEngine(code, {
      callbacks: {
        onStateChange: (roomCode) => broadcastRoomSnapshot(roomCode),
        onNotice: (roomCode, targets, notice) => {
          const engine = rooms.get(roomCode);
          if (!engine) return;
          const ids = targets === 'all' ? engine.getPlayerIds() : targets;
          for (const pid of ids) {
            const sid = engine.getSocketIdForPlayer(pid);
            if (sid) io.to(sid).emit('game:notice', notice);
          }
        },
        onLightsUpdated: (roomCode, state) => {
          io.to(roomCode).emit('lights:updated', state);
        },
        onChatMessage: (roomCode, msg) => {
          io.to(roomCode).emit('meeting:chatMessage', msg);
        },
      },
    });
  }

  function detachSocketFromCurrentRoom(socketId: string, explicitLeave: boolean): void {
    const session = socketSessions.get(socketId);
    if (!session) return;
    socketSessions.delete(socketId);
    const engine = rooms.get(session.roomCode);
    if (!engine) return;
    if (explicitLeave) {
      engine.leaveExplicitly(session.playerId);
    } else {
      engine.markDisconnected(session.playerId);
    }
    if (engine.isEmpty()) {
      rooms.delete(session.roomCode);
    }
  }

  // Periodic authoritative tick (disconnect 30s expiration & meeting timers)
  const tickTimer = setInterval(() => {
    const now = Date.now();
    for (const [code, engine] of [...rooms.entries()]) {
      engine.tick(now);
      if (engine.isEmpty()) {
        rooms.delete(code);
      }
    }
  }, 500);
  tickTimer.unref?.();

  io.on('connection', (socket) => {
    socket.on('room:create', (payload, cb) => {
      if (!payload || typeof payload.name !== 'string') {
        cb?.({ ok: false, error: 'Некорректное имя игрока.' });
        return;
      }
      detachSocketFromCurrentRoom(socket.id, true);

      let code = RoomGameEngine.createRoomCode();
      while (rooms.has(code)) {
        code = RoomGameEngine.createRoomCode();
      }
      const engine = createEngine(code);
      rooms.set(code, engine);

      const res = engine.addPlayer(payload.name, socket.id);
      if (!res.ok || !res.playerId || !res.sessionToken) {
        rooms.delete(code);
        cb?.({ ok: false, error: res.error ?? 'Не удалось создать комнату.' });
        return;
      }

      socket.join(code);
      socketSessions.set(socket.id, { roomCode: code, playerId: res.playerId });
      cb?.({
        ok: true,
        roomCode: code,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
      });
      broadcastRoomSnapshot(code);
    });

    socket.on('room:join', (payload, cb) => {
      if (!payload || typeof payload.roomCode !== 'string' || typeof payload.name !== 'string') {
        cb?.({ ok: false, error: 'Укажите код комнаты и имя.' });
        return;
      }
      const code = payload.roomCode.trim().toUpperCase();
      const engine = rooms.get(code);
      if (!engine) {
        cb?.({ ok: false, error: `Комната «${code}» не найдена.` });
        return;
      }

      detachSocketFromCurrentRoom(socket.id, true);
      const res = engine.addPlayer(payload.name, socket.id);
      if (!res.ok || !res.playerId || !res.sessionToken) {
        cb?.({ ok: false, error: res.error ?? 'Не удалось войти в комнату.' });
        return;
      }

      socket.join(code);
      socketSessions.set(socket.id, { roomCode: code, playerId: res.playerId });
      cb?.({
        ok: true,
        roomCode: code,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
      });
      broadcastRoomSnapshot(code);
    });

    socket.on('room:reconnect', (payload, cb) => {
      if (
        !payload ||
        typeof payload.roomCode !== 'string' ||
        typeof payload.sessionToken !== 'string'
      ) {
        cb?.({ ok: false, error: 'Некорректные данные переподключения.' });
        return;
      }
      const code = payload.roomCode.trim().toUpperCase();
      const engine = rooms.get(code);
      if (!engine) {
        cb?.({ ok: false, error: 'Комната больше не существует.' });
        return;
      }

      const res = engine.reconnectPlayer(payload.sessionToken, socket.id);
      if (!res.ok || !res.playerId) {
        cb?.({ ok: false, error: res.error ?? 'Не удалось переподключиться.' });
        return;
      }

      socket.join(code);
      socketSessions.set(socket.id, { roomCode: code, playerId: res.playerId });
      cb?.({ ok: true, roomCode: code, playerId: res.playerId });
      broadcastRoomSnapshot(code);
    });

    socket.on('room:selectColor', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload || typeof payload.color !== 'string') {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.selectColor(session.playerId, payload.color));
    });

    socket.on('room:leave', (cb) => {
      const session = socketSessions.get(socket.id);
      if (session) {
        socket.leave(session.roomCode);
      }
      detachSocketFromCurrentRoom(socket.id, true);
      cb?.({ ok: true });
    });

    socket.on('game:start', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Комната не найдена.' });
        return;
      }
      cb?.(engine.startMatch(session.playerId));
    });

    socket.on('game:returnToLobby', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Комната не найдена.' });
        return;
      }
      cb?.(engine.returnToLobby(session.playerId));
    });

    socket.on('player:move', (payload) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload) return;
      const moved = engine.movePlayer(session.playerId, payload.x, payload.z, payload.yaw);
      if (!moved) return;

      const snap = engine.getSnapshotForPlayer(session.playerId);
      const selfPub = snap?.players.find((p) => p.id === session.playerId);
      if (!selfPub) return;

      // Broadcast movement only to recipients allowed to see this player (hide observer movement from alive players!)
      for (const recipientId of engine.getPlayerIds()) {
        if (recipientId === session.playerId) continue;
        const recipientSock = engine.getSocketIdForPlayer(recipientId);
        if (!recipientSock) continue;
        const recipientSnap = engine.getSnapshotForPlayer(recipientId);
        const recipientPub = recipientSnap?.players.find((p) => p.id === recipientId);
        if (
          engine.phase === 'playing' &&
          selfPub.status === 'eliminated' &&
          recipientPub?.status === 'alive'
        ) {
          continue;
        }
        io.to(recipientSock).emit('player:moved', {
          playerId: selfPub.id,
          x: selfPub.x,
          z: selfPub.z,
          yaw: selfPub.yaw,
          shieldActiveUntil: selfPub.shieldActiveUntil,
        });
      }
    });

    socket.on('task:open', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.openTask(session.playerId, payload.taskId, payload.terminalId));
    });

    socket.on('task:submit', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.submitTask(session.playerId, payload.taskId, payload.stageIndex, payload.answer ?? {}));
    });

    socket.on('lights:open', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.openLightsPanel(session.playerId));
    });

    socket.on('lights:toggleSwitch', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.toggleLightsSwitch(session.playerId, payload.index));
    });

    socket.on('sabotage:lights', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.sabotageLights(session.playerId));
    });

    socket.on('sabotage:attack', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload || typeof payload.targetId !== 'string') {
        cb?.({ ok: false, error: 'Цель не указана.' });
        return;
      }
      const res = engine.attackPlayer(session.playerId, payload.targetId);
      cb?.({ ok: res.ok, error: res.error, data: { blockedByShield: Boolean(res.blockedByShield) } });
    });

    socket.on('shield:activate', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.activateShield(session.playerId));
    });

    socket.on('meeting:callEmergency', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.callEmergencyMeeting(session.playerId));
    });

    socket.on('meeting:reportBody', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.reportBody(session.playerId, payload?.bodyId));
    });

    socket.on('meeting:vote', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload || typeof payload.targetId !== 'string') {
        cb?.({ ok: false, error: 'Некорректный голос.' });
        return;
      }
      cb?.(engine.castVote(session.playerId, payload.targetId));
    });

    socket.on('meeting:chat', (payload, cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine || !payload || typeof payload.text !== 'string') {
        cb?.({ ok: false, error: 'Некорректное сообщение.' });
        return;
      }
      cb?.(engine.sendMeetingChat(session.playerId, payload.text));
    });

    socket.on('sensor:read', (cb) => {
      const session = socketSessions.get(socket.id);
      const engine = session ? rooms.get(session.roomCode) : undefined;
      if (!session || !engine) {
        cb?.({ ok: false, error: 'Сессия не найдена.' });
        return;
      }
      cb?.(engine.readSensorEcho(session.playerId));
    });

    socket.on('disconnect', () => {
      detachSocketFromCurrentRoom(socket.id, false);
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const host = process.env.HOST ?? '0.0.0.0';
  httpServer.listen(PORT, host, () => {
    console.log(`[Нулевая смена] Сервер запущен на http://${host}:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
