#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');

const help = `Мобильный smoke через четыре независимых клиента Chromium (390×844, touch).
Запустите игровой preview с Socket.IO самостоятельно. Тест не запускает сервер.
Из корня проекта, используя отдельный каталог зависимостей:
  PW_DIR=$(mktemp -d)
  npm install --prefix "$PW_DIR" playwright@1.62.1
  "$PW_DIR/node_modules/.bin/playwright" install chromium
  NODE_PATH="$PW_DIR/node_modules" node scripts/mobile-smoke.cjs http://localhost:3000
Для установленного Google Chrome пропустите install chromium и задайте SMOKE_CHANNEL=chrome.
Код 0 = все проверки прошли; 1 = сбой с названием шага. Данные профилей временные.`;
if (process.argv.includes('--help')) { console.log(help); process.exit(0); }

const names = ['Смоук Альфа', 'Смоук Бета', 'Смоук Гамма', 'Смоук Дельта'];
const timeout = 30_000;
const button = (p, name) => p.getByRole('button', { name });
const tap = (p, name) => button(p, name).tap();
const visible = locator => locator.waitFor({ state: 'visible' });
const joystick = p => p.locator('[data-joystick]');
const meeting = p => p.getByRole('dialog', { name: 'Собрание экипажа' });
let step = 'подготовка';
function stage(name) { step = name; console.log(`> ${name}`); }
async function until(check, message) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error(message);
    await delay(40);
  }
}

// Read only the motion of our host as received by a *different* browser. Never emit
// socket events from the test; names, actions, position and votes all come from UI input.
function observeHost(guest) {
  const seen = { id: null, position: null };
  guest.on('websocket', ws => {
    if (!new URL(ws.url()).pathname.startsWith('/socket.io/')) return;
    ws.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string' || !payload.startsWith('42[')) return;
      const [event, data] = JSON.parse(payload.slice(2));
      if (event === 'room:snapshot') {
        const host = data.players.find(p => p.name === names[0]);
        if (host) { seen.id = host.id; seen.position = host; }
      } else if (event === 'player:moved' && data.playerId === seen.id) seen.position = data;
    });
  });
  return seen;
}

// Chromium's native multi-touch API; no DOM dispatchEvent or programmatic clicks.
async function walk(page, look, whileHeld) {
  const pad = joystick(page);
  await visible(pad);
  const box = await pad.boundingBox();
  assert.ok(box, 'Нет геометрии джойстика');
  const first = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  const second = { x: 289, y: 420, id: 2 };
  const cdp = await page.context().newCDPSession(page);
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  try {
    await send('touchStart', [first]);
    if (look) await send('touchStart', [first, second]);
    await send('touchMove', [{ ...first, y: first.y - 34 }, ...(look ? [{ ...second, x: second.x + 35 }] : [])]);
    await whileHeld();
  } finally {
    try { await send('touchEnd', []); } finally { await cdp.detach(); }
  }
}

async function run() {
  const base = new URL(process.argv[2] || 'http://localhost:3000');
  assert.ok(['http:', 'https:'].includes(base.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Укажите URL локального preview.');
  const { chromium, devices } = require('playwright');
  const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL || undefined, headless: true });
  const pages = [], errors = [];
  try {
    stage('Создание комнаты и вход трёх гостей по коду');
    for (let i = 0; i < names.length; i++) {
      const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', locale: 'ru-RU' });
      context.setDefaultTimeout(timeout);
      const p = await context.newPage();
      p.on('pageerror', e => errors.push(`${names[i]}: ${e.message}`));
      pages.push(p);
    }
    const [host, guest] = pages;
    const seen = observeHost(guest);
    await host.goto(base.href, { waitUntil: 'domcontentloaded' });
    await host.getByLabel('Ваш позывной').fill(names[0]);
    await tap(host, 'Создать комнату');
    const code = (await host.locator('.lobby-code').innerText()).trim();
    assert.match(code, /^[A-Z0-9]{6}$/);
    assert.ok(await button(host, 'Начать смену').isDisabled(), 'Хозяин может начать без кворума');
    for (const [index, p] of pages.entries()) {
      if (!index) continue;
      await p.goto(base.href, { waitUntil: 'domcontentloaded' });
      await p.getByLabel('Ваш позывной').fill(names[index]);
      await p.getByLabel('Код комнаты').fill(code);
      await tap(p, 'Войти по коду');
      assert.equal((await p.locator('.lobby-code').innerText()).trim(), code);
    }
    await Promise.all(pages.map(p => visible(button(p, /Экипаж\s*4\//))));
    await Promise.all(pages.map(p => visible(p.getByTestId('station-3d-viewport').locator('canvas'))));
    stage('Ходьба и обзор двумя пальцами, движение видно гостю');
    await until(() => seen.position, 'Гость не получил позицию хозяина в лобби');
    const start = seen.position;
    await walk(host, true, () => until(() => {
      const { x, z, yaw } = seen.position;
      return Math.hypot(x - start.x, z - start.z) >= 0.25 && Math.abs(yaw - start.yaw) > 0.02;
    }, 'Гость не получил движение и поворот хозяина после touchMove'));

    stage('Выбор скафандра и проверка в составе экипажа другого клиента');
    await tap(host, 'Скафандр');
    await tap(host, /Медик/);
    await visible(host.getByRole('button', { name: /Медик/, pressed: true }));
    await tap(host, 'Закрыть панель');
    await tap(guest, /Экипаж\s*4\//);
    const roster = guest.getByRole('dialog').getByRole('listitem');
    for (const name of names) await visible(roster.filter({ hasText: name }));
    await visible(roster.filter({ hasText: names[0] }).getByText('Медик', { exact: true }));
    await tap(guest, 'Закрыть панель');

    stage('Старт: ворота открываются у всех четырёх, затем появляется HUD');
    // Arm waits before the tap; the gate status is transient.
    await Promise.all([ ...pages.map(p => visible(p.getByText('Ворота открываются…', { exact: true }))), tap(host, 'Начать смену') ]);
    await Promise.all(pages.map(p => visible(p.getByText('Активных игроков: 4', { exact: true }))));
    for (const p of pages) {
      assert.equal(await p.getByText('Ворота открываются…', { exact: true }).count(), 0);
      assert.equal(await p.getByText(/3D недоступно/).count(), 0);
    }
    stage('Карта, подход джойстиком и экстренный созыв тапом');
    await tap(host, /Открыть карту станции/);
    await visible(host.getByRole('dialog', { name: 'Схема станции' }));
    await tap(host, 'Закрыть карту');
    const emergency = button(host, /Созвать экстренное собрание/);
    // Host spawns facing the central meeting table, just outside interaction range.
    await walk(host, false, () => visible(emergency));
    await emergency.tap();
    await Promise.all(pages.map(p => visible(meeting(p))));

    stage('Выбор и подтверждение голосов, общий итог и возврат всех в игру');
    for (const p of pages) assert.ok(await button(p, 'Подтвердить голос').isDisabled());
    // One candidate vote, three skips: deterministic outcome regardless of roles.
    await meeting(host).getByRole('radio', { name: new RegExp(names[1]) }).tap();
    await visible(guest.getByText('На связи проголосовали: 0 из 4', { exact: true }));
    await tap(host, 'Подтвердить голос');
    await visible(guest.getByText('На связи проголосовали: 1 из 4', { exact: true }));
    for (const p of pages.slice(1)) await meeting(p).getByRole('radio', { name: 'Пропустить голосование' }).tap();
    await Promise.all([
      ...pages.map(p => visible(meeting(p).getByText('Голосование пропущено. Никто не выбывает.', { exact: true }))),
      ...pages.slice(1).map(p => tap(p, 'Подтвердить голос')),
    ]);
    await Promise.all(pages.map(p => visible(meeting(p).getByLabel('Пропусков: 3'))));
    await Promise.all(pages.map(p => visible(p.getByText('Активных игроков: 4', { exact: true }))));
    assert.deepEqual(errors, [], 'Необработанные ошибки страницы');
    console.log('PASS: четыре мобильных клиента вернулись в матч после голосования.');
  } catch (error) {
    for (const [i, p] of pages.entries()) {
      const state = await p.locator('body').innerText({ timeout: 1500 }).catch(() => '(страница недоступна)');
      console.error(`${names[i]}: ${state.replace(/\s+/g, ' ').slice(0, 500)}`);
    }
    for (const msg of errors) console.error(msg);
    throw error;
  } finally { await browser.close(); }
}
run().catch(error => { console.error(`FAIL [${step}] ${error.message}`); process.exitCode = 1; });
