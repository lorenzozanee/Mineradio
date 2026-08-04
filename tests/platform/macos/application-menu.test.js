'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlatform } = require('../../../desktop/platform');
const {
  createApplicationMenuTemplate,
  installApplicationMenu,
} = require('../../../desktop/platform/macos/application-menu');

test('macOS application menu uses native roles with top-level submenus', () => {
  const template = createApplicationMenuTemplate();
  assert.deepEqual(template.map(item => item.role || item.label), [
    'appMenu',
    'editMenu',
    '显示',
    'windowMenu',
  ]);
  assert.ok(template.every(item => item.role || Array.isArray(item.submenu)));
  assert.deepEqual(template[2].submenu, [{ role: 'togglefullscreen' }]);
});

test('macOS ready lifecycle installs exactly one application menu', async () => {
  const calls = [];
  const menu = { id: 'application-menu' };
  const Menu = {
    buildFromTemplate(template) { calls.push(['build', template]); return menu; },
    setApplicationMenu(value) { calls.push(['set', value]); },
  };
  const platform = createPlatform({ nodePlatform: 'darwin', Menu });
  assert.deepEqual(await platform.lifecycle.onReady(), { ok: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'build');
  assert.equal(calls[1][0], 'set');
  assert.equal(calls[1][1], menu);
});

test('macOS application menu reports unavailable dependencies without throwing', () => {
  assert.deepEqual(installApplicationMenu({}), {
    ok: false,
    error: 'MACOS_APPLICATION_MENU_UNAVAILABLE',
  });
});

test('macOS activation restores the Dock when the API is available', () => {
  let shown = 0;
  const platform = createPlatform({
    nodePlatform: 'darwin',
    app: { dock: { show() { shown += 1; } } },
  });
  assert.deepEqual(platform.lifecycle.onActivate(), { ok: true });
  assert.equal(shown, 1);
});

test('macOS main window opts into native traffic lights', () => {
  const platform = createPlatform({ nodePlatform: 'darwin' });
  assert.deepEqual(platform.window.mainOptions(), {
    frame: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
  });
});

test('macOS desktop lyrics use a panel across fullscreen Spaces', () => {
  const calls = [];
  const win = {
    setAlwaysOnTop(value, level) { calls.push(['top', value, level]); },
    setVisibleOnAllWorkspaces(value, options) { calls.push(['spaces', value, options]); },
  };
  const platform = createPlatform({ nodePlatform: 'darwin' });
  assert.deepEqual(platform.window.desktopLyricsOptions(), {
    type: 'panel',
    hiddenInMissionControl: true,
  });
  assert.deepEqual(platform.window.configureDesktopLyricsWindow(win), { ok: true });
  assert.deepEqual(calls, [
    ['top', true, 'floating'],
    ['spaces', true, { visibleOnFullScreen: true }],
  ]);
});
