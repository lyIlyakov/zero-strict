window.STATE =
{
  "version": 2,
  "slug": "dock",
  "dir": "2026-11-24-dock--wip",
  "title": "Станция Каскад: подготовка смены",
  "mode": "semi",
  "depth": "normal",
  "tier": "T2",
  "briefFile": "2026-11-24-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "autopilot",
  "skillDir": "/home/ilya/.claude/skills/autopilot",
  "baseCommit": null,
  "startedAt": "2026-11-24T15:52:00+01:00",
  "updatedAt": "2026-11-24T15:53:55+01:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-24T15:52:00+01:00",
      "finishedAt": "2026-11-24T15:52:00+01:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-24T15:52:00+01:00",
      "finishedAt": "2026-11-24T15:52:16+01:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-24T15:52:16+01:00",
      "finishedAt": "2026-11-24T15:52:46+01:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-24T15:52:46+01:00",
      "finishedAt": "2026-11-24T15:53:19+01:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-11-24T15:53:19+01:00",
      "finishedAt": "2026-11-24T15:53:20+01:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-11-24T15:53:20+01:00"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 13,
    "done": 0,
    "inTicket": 13,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Совместный шлюз и правила",
      "requirements": [
        "R03",
        "R07",
        "R12",
        "R13"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "server/",
        "server.ts",
        "shared/types.ts",
        "src/components/LobbyView.tsx"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "in-progress",
      "startedAt": "2026-11-24T15:53:20+01:00",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "02",
      "title": "Управление станцией",
      "requirements": [
        "R07",
        "R08",
        "R10",
        "R11"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/App.tsx",
        "src/game/FirstPersonViewport.tsx",
        "src/components/GameHud.tsx"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "in-progress",
      "startedAt": "2026-11-24T15:53:20+01:00",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "03",
      "title": "Облик станции, карта и собрание",
      "requirements": [
        "R01",
        "R02",
        "R04",
        "R05",
        "R06",
        "R08",
        "R09",
        "R12"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/components/MainMenu.tsx",
        "src/components/MeetingModal.tsx",
        "src/game/station3d.ts"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "in-progress",
      "startedAt": "2026-11-24T15:53:20+01:00",
      "retries": 0,
      "repairs": 0
    }
  ],
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 3,
    "fixed": 3,
    "deferred": 0,
    "items": []
  },
  "concerns": [],
  "blind": null,
  "beats": [
    "2026-11-24T15:52:00+01:00",
    "2026-11-24T15:52:16+01:00",
    "2026-11-24T15:52:46+01:00",
    "2026-11-24T15:53:19+01:00",
    "2026-11-24T15:53:20+01:00",
    "2026-11-24T15:53:55+01:00"
  ],
  "rev": 15,
  "waiting": null,
  "waits": [],
  "log": [
    {
      "t": "2026-11-24T15:52:00+01:00",
      "k": "init"
    },
    {
      "t": "2026-11-24T15:52:00+01:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-11-24T15:52:16+01:00",
      "k": "stage",
      "id": "briefing",
      "act": "start"
    },
    {
      "t": "2026-11-24T15:52:46+01:00",
      "k": "gate",
      "g": "G1",
      "ok": true,
      "open": 0,
      "total": 13
    },
    {
      "t": "2026-11-24T15:52:46+01:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-11-24T15:53:19+01:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 3,
      "fixed": 3,
      "deferred": 0
    },
    {
      "t": "2026-11-24T15:53:19+01:00",
      "k": "stage",
      "id": "plan",
      "act": "start"
    },
    {
      "t": "2026-11-24T15:53:20+01:00",
      "k": "tier",
      "v": "T2"
    },
    {
      "t": "2026-11-24T15:53:20+01:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-11-24T15:53:20+01:00",
      "k": "gate",
      "g": "G3",
      "ok": false,
      "problems": 3
    },
    {
      "t": "2026-11-24T15:53:20+01:00",
      "k": "stage",
      "id": "build",
      "act": "start"
    },
    {
      "t": "2026-11-24T15:53:20+01:00",
      "k": "ticket",
      "ids": [
        "01",
        "02",
        "03"
      ],
      "act": "start"
    },
    {
      "t": "2026-11-24T15:53:55+01:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-11-24T15:53:55+01:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«сгенерировать новые качествеенные ассеты шейдеры и 3д моделя»",
      "status": "in-ticket"
    },
    {
      "id": "R02",
      "text": "«главное что-бы не рябило в глазах»",
      "status": "in-ticket"
    },
    {
      "id": "R03",
      "text": "«проработай механики»",
      "status": "in-ticket"
    },
    {
      "id": "R04",
      "text": "«главный экран»",
      "status": "in-ticket"
    },
    {
      "id": "R05",
      "text": "«меню голосования за предателя»",
      "status": "in-ticket"
    },
    {
      "id": "R06",
      "text": "«добавь новые звуки»",
      "status": "in-ticket"
    },
    {
      "id": "R07",
      "text": "«в комнате ожидания можно ходить и менять скин»",
      "status": "in-ticket"
    },
    {
      "id": "R08",
      "text": "«потом открываются ворота и игра начинается»",
      "status": "in-ticket"
    },
    {
      "id": "R09",
      "text": "«улучши карту»",
      "status": "in-ticket"
    },
    {
      "id": "R10",
      "text": "«добавь мобильное управление»",
      "status": "in-ticket"
    },
    {
      "id": "R11",
      "text": "«не через все кнопки можно взаимодействовать приходиться крсором такого быть не должно»",
      "status": "in-ticket"
    },
    {
      "id": "R12",
      "text": "«добавь новые скины»",
      "status": "in-ticket"
    },
    {
      "id": "R13",
      "text": "«подробные настроки раунда сколько играков в комнате какие правила»",
      "status": "in-ticket"
    }
  ],
  "gates": {
    "G1": {
      "ok": true,
      "at": "2026-11-24T15:52:46+01:00",
      "open": 0,
      "total": 13
    },
    "G2": {
      "ok": true,
      "at": "2026-11-24T15:53:19+01:00",
      "found": 3,
      "fixed": 3,
      "deferred": 0
    },
    "G3": {
      "ok": true,
      "at": "2026-11-24T15:53:55+01:00",
      "problems": 0
    }
  },
  "result": null
}
