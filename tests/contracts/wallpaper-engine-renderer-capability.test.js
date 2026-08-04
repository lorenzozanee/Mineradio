'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../public/js/modules/07-fx/03-wallpaper-engine-library.js'),
  'utf8'
);

test('persisted Wallpaper Engine state has zero native side effects when capability is unavailable', function() {
  const stored = new Map([['mineradio-wallpaper-engine-selection-v1', JSON.stringify({
    active: true,
    id: '0123456789abcdef01234567',
    title: 'Persisted fixture',
    kind: 'engine',
  })]]);
  const nativeCalls = [];
  const timers = [];
  let capabilityCallback = null;
  const classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const context = vm.createContext({
    console,
    Map,
    Promise,
    clearInterval() {},
    clearTimeout() {},
    document: {
      body: { classList },
      hidden: false,
      addEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return []; },
    },
    getDesktopWindowApi() {
      return {
        listWallpaperEngineProjects() { nativeCalls.push('list'); },
        startWallpaperEngineScene() { nativeCalls.push('start'); },
        stopWallpaperEngineScene() { nativeCalls.push('stop'); },
      };
    },
    localStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, String(value)); },
    },
    navigator: {},
    setInterval(callback) { timers.push(callback); return timers.length; },
    setTimeout(callback) { timers.push(callback); return timers.length; },
    subscribePlatformCapability(name, callback) {
      assert.equal(name, 'wallpaperEngine');
      capabilityCallback = callback;
      return function() {};
    },
    window: {
      addEventListener() {},
      desktopWindow: null,
    },
  });

  vm.runInContext(source, context, { filename: '03-wallpaper-engine-library.js' });
  assert.equal(typeof capabilityCallback, 'function');
  capabilityCallback(false);

  assert.deepEqual(nativeCalls, []);
  assert.deepEqual(timers, []);
  const selection = JSON.parse(stored.get('mineradio-wallpaper-engine-selection-v1'));
  assert.equal(selection.active, false);
});
