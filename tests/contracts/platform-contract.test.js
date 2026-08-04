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

test('platform contract exposes a bounded serializable capability snapshot', () => {
  const platform = createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
    quitWhenAllWindowsClosed: false,
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
    desktopMode: desktopModeService(),
  }), /Unknown platform capabilities/);
  assert.throws(() => createPlatformContract({
    id: 'fixture',
    nodePlatform: 'darwin',
    capabilities: {},
    desktopMode: {},
  }), /desktopMode\.enable/);
});

test('unsupported results remain status-compatible for renderer consumers', () => {
  assert.deepEqual(unsupportedResult('darwin', 'fullDesktopMode'), {
    ok: false,
    unsupported: true,
    enabled: false,
    platform: 'darwin',
    capability: 'fullDesktopMode',
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
