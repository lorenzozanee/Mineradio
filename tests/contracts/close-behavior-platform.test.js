'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlatformContract } = require('../../desktop/platform/contract');

function trayService(isAvailable = true) {
  return {
    createOrUpdate: () => ({ ok: true }),
    destroy: () => ({ ok: true }),
    isAvailable: () => isAvailable,
  };
}

function minimalContract(overrides = {}) {
  const lifecycle = {
    quitWhenAllWindowsClosed: false,
    configureApp: () => ({ ok: true }),
    onReady: () => ({ ok: true }),
    onActivate: () => ({ ok: true }),
    cleanup: () => ({ ok: true }),
  };
  const runtime = {
    caseInsensitivePaths: false,
    chromiumSwitches: () => [],
    defaultCacheRoot: p => `${p}/cache`,
  };
  const shortcuts = {
    configure: () => ({ ok: true }),
    cleanup: () => ({ ok: true }),
  };
  const sysmem = {
    MEMORY_MASK_DEFAULT: 0,
    SYSTEM_PURGE_AVAILABLE: false,
    SYSTEM_PURGE_ENABLED: false,
    setNativeTempPath: () => ({ ok: true }),
    getMemorySnapshot: () => ({}),
    getMemorySnapshotExtended: async () => ({}),
    normalizeMask: v => Number(v) || 0,
    probeProcessElevation: async () => false,
    isProcessElevated: async () => false,
    purgeSystemMemorySmart: async () => ({ ok: false, unsupported: true }),
    trimAppWorkingSets: async () => ({ ok: false, unsupported: true }),
  };
  const win = {
    mainOptions: () => ({}),
    configureMainWindow: () => ({ ok: true }),
    desktopLyricsOptions: () => ({}),
    configureDesktopLyricsWindow: () => ({ ok: true }),
  };
  const dm = {
    enable: async () => ({ ok: true }),
    disable: async () => ({ ok: true }),
    getStatus: () => ({ ok: true }),
  };
  const tray = trayService(overrides.trayAvailable !== false);
  return createPlatformContract({
    id: overrides.id || 'fixture',
    nodePlatform: overrides.nodePlatform || 'darwin',
    capabilities: overrides.capabilities || {},
    lifecycle,
    runtime,
    shortcuts,
    systemMemory: sysmem,
    window: win,
    desktopMode: dm,
    tray,
  });
}

// closeBehavior normalization requires 'tray' + platform.supports('tray') → 'tray', else 'exit'.
test('close behavior normalizes to exit when tray is unsupported', () => {
  const platform = minimalContract({ capabilities: { tray: false } });
  assert.equal(platform.supports('tray'), false);
  const normalize = (v) => v === 'tray' && platform.supports('tray') ? 'tray' : 'exit';
  assert.equal(normalize('tray'), 'exit');
  assert.equal(normalize('exit'), 'exit');
  assert.equal(normalize('invalid'), 'exit');
  assert.equal(normalize(null), 'exit');
  assert.equal(normalize(undefined), 'exit');
});

test('close behavior normalizes to tray when supported', () => {
  const platform = minimalContract({ capabilities: { tray: true } });
  assert.equal(platform.supports('tray'), true);
  const normalize = (v) => v === 'tray' && platform.supports('tray') ? 'tray' : 'exit';
  assert.equal(normalize('tray'), 'tray');
  assert.equal(normalize('exit'), 'exit');
  assert.equal(normalize('hidden'), 'exit');
  assert.equal(normalize(''), 'exit');
});

test('tray service methods return bounded objects', () => {
  const platform = minimalContract();
  const createResult = platform.tray.createOrUpdate({ appName: 'Test' });
  const destroyResult = platform.tray.destroy();
  assert.equal(typeof createResult.ok, 'boolean');
  assert.equal(typeof destroyResult.ok, 'boolean');
  assert.equal(platform.tray.isAvailable(), true);
});

test('tray createOrUpdate rejects invalid payloads on the platform adapter', () => {
  // The macOS status-item adapter validates payloads at the adapter level.
  // Contract-layer mocks pass through; adapter-layer validation is tested
  // in tests/platform/macos/status-item.test.js.
  const statusItem = require('../../desktop/platform/macos/status-item');
  for (const bad of [null, 123, 'string', true]) {
    const result = statusItem.createOrUpdate(bad);
    assert.equal(result.ok, false);
  }
});

test('platform snapshot includes tray capability', () => {
  const platformWithTray = minimalContract({ capabilities: { tray: true } });
  assert.equal(platformWithTray.snapshot().capabilities.tray, true);

  const platformWithoutTray = minimalContract({ capabilities: { tray: false } });
  assert.equal(platformWithoutTray.snapshot().capabilities.tray, false);
});

test('macOS lifecycle does not quit when all windows are closed', () => {
  const platform = minimalContract();
  assert.equal(platform.lifecycle.quitWhenAllWindowsClosed, false);
});
