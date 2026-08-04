'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlatform } = require('../../../desktop/platform');

test('macOS platform reports unsupported native desktop capabilities', async () => {
  const platform = createPlatform({ nodePlatform: 'darwin' });
  assert.deepEqual(platform.snapshot(), {
    ok: true,
    platform: 'darwin',
    platformId: 'macos',
    capabilities: {
      fullDesktopMode: false,
      wallpaperEngine: false,
      tray: false,
    },
  });
  assert.equal(platform.lifecycle.quitWhenAllWindowsClosed, false);
  assert.deepEqual(platform.lifecycle.configureApp(), { ok: true });
  assert.deepEqual(platform.runtime.chromiumSwitches(), []);
  assert.equal(Object.hasOwn(platform.window.mainOptions(), 'icon'), false);
  for (const result of [
    await platform.desktopMode.enable({}),
    await platform.desktopMode.disable('test'),
    platform.desktopMode.getStatus('test'),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.unsupported, true);
    assert.equal(result.error, 'PLATFORM_CAPABILITY_UNSUPPORTED');
    assert.equal(result.status.supported, false);
  }
});

test('unsupported host platforms fail at the composition root', () => {
  assert.throws(
    () => createPlatform({ nodePlatform: 'linux' }),
    error => error && error.code === 'MINERADIO_UNSUPPORTED_PLATFORM'
  );
});
