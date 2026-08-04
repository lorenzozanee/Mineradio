'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlatform } = require('../../../desktop/platform');

test('Windows platform reports native capabilities and delegates desktop mode', async () => {
  const calls = [];
  const platform = createPlatform({
    nodePlatform: 'win32',
    desktopMode: {
      enable: async payload => { calls.push(['enable', payload]); return { ok: true, enabled: true, token: 'win-enable' }; },
      disable: async reason => { calls.push(['disable', reason]); return { ok: true, enabled: false, token: 'win-disable' }; },
      getStatus: reason => { calls.push(['status', reason]); return { ok: true, enabled: false, token: 'win-status' }; },
    },
  });

  assert.deepEqual(platform.snapshot().capabilities, {
    fullDesktopMode: true,
    wallpaperEngine: true,
    tray: true,
  });
  assert.deepEqual(await platform.desktopMode.enable({ reason: 'test-enable' }), { ok: true, enabled: true, token: 'win-enable' });
  assert.deepEqual(await platform.desktopMode.disable('test-disable'), { ok: true, enabled: false, token: 'win-disable' });
  assert.deepEqual(platform.desktopMode.getStatus('test-status'), { ok: true, enabled: false, token: 'win-status' });
  assert.deepEqual(calls, [
    ['enable', { reason: 'test-enable' }],
    ['disable', 'test-disable'],
    ['status', 'test-status'],
  ]);
  assert.equal(platform.lifecycle.quitWhenAllWindowsClosed, true);
});
