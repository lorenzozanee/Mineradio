'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { loadNativeDesktopFeatures } = require('../../desktop/platform');

test('macOS native desktop feature selection never resolves Windows implementations', function() {
  const loaded = [];
  const fixture = { platform: 'macos' };
  const result = loadNativeDesktopFeatures({
    nodePlatform: 'darwin',
    load(request) {
      loaded.push(request);
      return fixture;
    },
  });
  assert.equal(result, fixture);
  assert.deepEqual(loaded, ['./macos/native-desktop-features']);
});

test('Windows native desktop feature selection composes the three existing implementations', function() {
  const loaded = [];
  const result = loadNativeDesktopFeatures({
    nodePlatform: 'win32',
    load(request) {
      loaded.push(request);
      if (request.includes('library')) return { WallpaperEngineLibrary: class WallpaperEngineLibrary {} };
      if (request.includes('wallpaper-engine-runtime')) return { WallpaperEngineRuntime: class WallpaperEngineRuntime {} };
      return { FullDesktopModeRuntime: class FullDesktopModeRuntime {} };
    },
  });
  assert.equal(typeof result.WallpaperEngineLibrary, 'function');
  assert.equal(typeof result.WallpaperEngineRuntime, 'function');
  assert.equal(typeof result.FullDesktopModeRuntime, 'function');
  assert.deepEqual(loaded, [
    '../wallpaper-engine-library',
    '../wallpaper-engine-runtime',
    '../full-desktop-mode-runtime',
  ]);
});

test('macOS unsupported native desktop implementations are bounded and side-effect free', async function() {
  const features = loadNativeDesktopFeatures({ nodePlatform: 'darwin' });
  const library = new features.WallpaperEngineLibrary();
  const runtime = new features.WallpaperEngineRuntime();
  const desktopMode = new features.FullDesktopModeRuntime();
  for (const result of [
    await library.list(),
    await runtime.start(),
    await runtime.stop(),
    await desktopMode.enable(),
    await desktopMode.reconcile(),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.unsupported, true);
    assert.equal(result.error, 'PLATFORM_CAPABILITY_UNSUPPORTED');
    assert.equal(result.platform, 'darwin');
  }
  assert.equal(runtime.active, null);
  assert.equal(runtime.pending, null);
  assert.equal(desktopMode.getStatus('fixture').enabled, false);
});

test('macOS unsupported native desktop cleanup is idempotently successful', async function() {
  const features = loadNativeDesktopFeatures({ nodePlatform: 'darwin' });
  const library = new features.WallpaperEngineLibrary();
  const runtime = new features.WallpaperEngineRuntime();
  const desktopMode = new features.FullDesktopModeRuntime();

  const libraryCleanup = library.dispose();
  assert.equal(libraryCleanup.ok, true);
  assert.equal(libraryCleanup.unsupported, true);
  assert.equal(libraryCleanup.operation, 'dispose');

  for (const cleanup of [
    await runtime.dispose(),
    await runtime.dispose(),
  ]) {
    assert.equal(cleanup.ok, true);
    assert.equal(cleanup.unsupported, true);
    assert.equal(cleanup.stopped, true);
    assert.equal(cleanup.active, false);
    assert.equal(cleanup.pending, false);
  }

  for (const cleanup of [
    await desktopMode.dispose(),
    await desktopMode.dispose(),
  ]) {
    assert.equal(cleanup.ok, true);
    assert.equal(cleanup.unsupported, true);
    assert.equal(cleanup.enabled, false);
    assert.equal(cleanup.interactive, false);
  }
});

test('unknown native desktop feature platforms fail at the composition root', function() {
  assert.throws(function() {
    loadNativeDesktopFeatures({ nodePlatform: 'linux' });
  }, /Unsupported native desktop feature platform/);
});
