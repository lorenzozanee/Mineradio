'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PLATFORM_CAPABILITY_KEYS,
  createPlatformContract,
  unsupportedResult,
} = require('../../desktop/platform/contract');

function desktopModeService() {
  return {
    enable: async () => ({ ok: true, enabled: true }),
    disable: async () => ({ ok: true, enabled: false }),
    getStatus: () => ({ ok: true, enabled: false }),
  };
}

function lifecycleService(quitWhenAllWindowsClosed = false) {
  return {
    quitWhenAllWindowsClosed,
    onReady: async () => ({ ok: true }),
    onActivate: () => ({ ok: true }),
    cleanup: async () => ({ ok: true }),
  };
}

function windowService() {
  return {
    mainOptions: () => ({}),
    configureMainWindow: () => ({ ok: true }),
    desktopLyricsOptions: () => ({}),
    configureDesktopLyricsWindow: () => ({ ok: true }),
  };
}

function runtimeService() {
  return {
    chromiumSwitches: () => [],
  };
}

function shortcutService() {
  return {
    configure: () => ({ ok: true, results: [] }),
    cleanup: () => ({ ok: true }),
  };
}

test('platform contract exposes a bounded serializable capability snapshot', () => {
  const platform = createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
    lifecycle: lifecycleService(false),
    runtime: runtimeService(),
    shortcuts: shortcutService(),
    window: windowService(),
    desktopMode: desktopModeService(),
  });
  assert.deepEqual(Object.keys(platform.capabilities), Array.from(PLATFORM_CAPABILITY_KEYS));
  assert.deepEqual(JSON.parse(JSON.stringify(platform.snapshot())), {
    ok: true,
    platform: 'darwin',
    platformId: 'fixture',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
  });
  assert.equal(platform.lifecycle.quitWhenAllWindowsClosed, false);
});

test('platform contract rejects unknown capabilities and incomplete services', () => {
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: { linuxDesktopMode: true },
    lifecycle: lifecycleService(),
    runtime: runtimeService(),
    shortcuts: shortcutService(),
    window: windowService(),
    desktopMode: desktopModeService(),
  }), /Unknown platform capabilities/);
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    lifecycle: lifecycleService(),
    runtime: runtimeService(),
    shortcuts: shortcutService(),
    window: windowService(),
    desktopMode: {},
  }), /desktopMode\.enable/);
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    lifecycle: {},
    runtime: runtimeService(),
    shortcuts: shortcutService(),
    window: windowService(),
    desktopMode: desktopModeService(),
  }), /lifecycle\.onReady/);
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    lifecycle: lifecycleService(),
    runtime: runtimeService(),
    shortcuts: shortcutService(),
    window: {},
    desktopMode: desktopModeService(),
  }), /window\.mainOptions/);
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    lifecycle: lifecycleService(),
    runtime: {},
    shortcuts: shortcutService(),
    window: windowService(),
    desktopMode: desktopModeService(),
  }), /runtime\.chromiumSwitches/);
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    lifecycle: lifecycleService(),
    runtime: runtimeService(),
    shortcuts: {},
    window: windowService(),
    desktopMode: desktopModeService(),
  }), /shortcuts\.configure/);
});

test('platform lifecycle and window services preserve adapter behavior', async () => {
  const calls = [];
  const platform = createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    lifecycle: {
      quitWhenAllWindowsClosed: false,
      onReady: async () => { calls.push('ready'); return { ok: true }; },
      onActivate: () => { calls.push('activate'); return { ok: true }; },
      cleanup: async () => { calls.push('cleanup'); return { ok: true }; },
    },
    runtime: {
      chromiumSwitches: () => [['fixture-switch', 'fixture-value']],
    },
    shortcuts: {
      configure: bindings => { calls.push(['shortcuts', bindings]); return { ok: true }; },
      cleanup: () => { calls.push('shortcut-cleanup'); return { ok: true }; },
    },
    window: {
      mainOptions: () => ({ titleBarStyle: 'hiddenInset' }),
      configureMainWindow: win => { calls.push(['main', win]); return { ok: true }; },
      desktopLyricsOptions: () => ({ type: 'panel' }),
      configureDesktopLyricsWindow: win => { calls.push(['lyrics', win]); return { ok: true }; },
    },
    desktopMode: desktopModeService(),
  });
  const mainWindow = { id: 'main' };
  const lyricsWindow = { id: 'lyrics' };
  assert.deepEqual(platform.window.mainOptions(), { titleBarStyle: 'hiddenInset' });
  assert.deepEqual(platform.runtime.chromiumSwitches(), [['fixture-switch', 'fixture-value']]);
  assert.deepEqual(platform.shortcuts.configure([{ action: 'togglePlay' }]), { ok: true });
  assert.deepEqual(platform.shortcuts.cleanup(), { ok: true });
  assert.deepEqual(platform.window.desktopLyricsOptions(), { type: 'panel' });
  assert.deepEqual(platform.window.configureMainWindow(mainWindow), { ok: true });
  assert.deepEqual(platform.window.configureDesktopLyricsWindow(lyricsWindow), { ok: true });
  assert.deepEqual(await platform.lifecycle.onReady(), { ok: true });
  assert.deepEqual(platform.lifecycle.onActivate(), { ok: true });
  assert.deepEqual(await platform.lifecycle.cleanup(), { ok: true });
  assert.deepEqual(calls, [
    ['shortcuts', [{ action: 'togglePlay' }]],
    'shortcut-cleanup',
    ['main', mainWindow],
    ['lyrics', lyricsWindow],
    'ready',
    'activate',
    'cleanup',
  ]);
});

test('unsupported results remain status-compatible for renderer consumers', () => {
  assert.deepEqual(unsupportedResult('darwin', 'fullDesktopMode'), {
    ok: false,
    unsupported: true,
    enabled: false,
    platform: 'darwin',
    capability: 'fullDesktopMode',
    operation: '',
    error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
    status: {
      supported: false,
      active: false,
      enabled: false,
      interactive: false,
      platform: 'darwin',
      capability: 'fullDesktopMode',
      lastError: 'PLATFORM_CAPABILITY_UNSUPPORTED',
    },
  });
});
