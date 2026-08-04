'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const { WallpaperEngineRuntime } = require('../../desktop/wallpaper-engine-runtime');

test('explicitly disabled desktop capture never loads Electron', () => {
  const originalLoad = Module._load;
  Module._load = function guardedLoad(request, parent, isMain) {
    if (request === 'electron') throw new Error('ELECTRON_MUST_NOT_LOAD');
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const runtime = new WallpaperEngineRuntime({
      desktopCapturer: null,
      useDesktopShellBroker: false,
    });
    assert.equal(runtime.desktopCapturer, null);
  } finally {
    Module._load = originalLoad;
  }
});

test('injected Qishui auth keeps the shared bridge independent from Electron', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-qishui-injected-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const modulePath = require.resolve('../../qishui-qr-login');
  delete require.cache[modulePath];
  const originalLoad = Module._load;
  Module._load = function guardedLoad(request, parent, isMain) {
    if (request === './qishui-auth-v6' || request === 'electron') {
      throw new Error('DEFAULT_ELECTRON_AUTH_MUST_NOT_LOAD');
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { createQishuiQrLoginBridge } = require(modulePath);
    const auth = {
      configure() {},
      async getQrCode() { return { data: { token: 'test', qrcode: 'test' } }; },
      async checkQrConnect() { return { ok: true }; },
      async clear() {},
    };
    const bridge = createQishuiQrLoginBridge({
      auth,
      configFile: path.join(tempRoot, 'qishui-qr.json'),
    });
    assert.equal(bridge.getStatus().provider, 'qishui');
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
  }
});
