'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../public/js/modules/00-state/00-platform-capabilities.js'),
  'utf8'
);

function createHarness(capabilities) {
  const elements = [
    {
      hidden: false,
      attributes: { 'data-platform-capability': 'fullDesktopMode' },
      getAttribute(name) { return this.attributes[name] || ''; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
    },
    {
      hidden: false,
      attributes: { 'data-platform-capability': 'wallpaperEngine' },
      getAttribute(name) { return this.attributes[name] || ''; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
    },
    {
      hidden: false,
      attributes: { 'data-platform-capability': 'tray' },
      getAttribute(name) { return this.attributes[name] || ''; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
    },
  ];
  const listeners = new Map();
  const documentElement = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
  const window = {
    desktopWindow: {
      getPlatformCapabilities: async () => ({
        ok: true,
        platform: capabilities.fullDesktopMode ? 'win32' : 'darwin',
        platformId: capabilities.fullDesktopMode ? 'windows' : 'macos',
        capabilities,
      }),
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
  };
  const context = vm.createContext({
    console,
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    },
    document: {
      documentElement,
      querySelectorAll: () => elements,
    },
    window,
  });
  vm.runInContext(source, context, { filename: '00-platform-capabilities.js' });
  return { context, documentElement, elements, listeners };
}

test('renderer hides unsupported native controls on macOS', async () => {
  const harness = createHarness({ fullDesktopMode: false, wallpaperEngine: false, tray: false });
  await harness.context.initializePlatformCapabilities();
  assert.equal(harness.elements[0].hidden, true);
  assert.equal(harness.elements[1].hidden, true);
  assert.equal(harness.elements[2].hidden, true);
  assert.equal(harness.documentElement.attributes['data-platform'], 'darwin');
  assert.equal(harness.documentElement.attributes['data-platform-ready'], 'true');
});

test('renderer reveals verified native controls on Windows', async () => {
  const harness = createHarness({ fullDesktopMode: true, wallpaperEngine: true, tray: true });
  await harness.context.initializePlatformCapabilities();
  assert.equal(harness.elements[0].hidden, false);
  assert.equal(harness.elements[1].hidden, false);
  assert.equal(harness.elements[2].hidden, false);
  assert.equal(harness.documentElement.attributes['data-platform'], 'win32');
});

test('capability subscribers fail closed, receive the resolved state, and unsubscribe cleanly', function() {
  const harness = createHarness({ fullDesktopMode: false, wallpaperEngine: false, tray: false });
  const calls = [];
  const unsubscribe = harness.context.subscribePlatformCapability('wallpaperEngine', function(available) {
    calls.push(available);
  });
  assert.deepEqual(calls, []);
  harness.context.applyPlatformCapabilities({
    ok: true,
    platform: 'darwin',
    platformId: 'macos',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
  });
  assert.deepEqual(calls, [false]);
  harness.context.applyPlatformCapabilities({
    ok: true,
    platform: 'win32',
    platformId: 'windows',
    capabilities: { fullDesktopMode: true, wallpaperEngine: true, tray: true },
  });
  assert.deepEqual(calls, [false, true]);
  unsubscribe();
  harness.context.applyPlatformCapabilities(null);
  assert.deepEqual(calls, [false, true]);
});

test('late capability subscribers receive the current resolved unsupported state immediately', function() {
  const harness = createHarness({ fullDesktopMode: false, wallpaperEngine: false, tray: false });
  harness.context.applyPlatformCapabilities({
    ok: true,
    platform: 'darwin',
    platformId: 'macos',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
  });
  const calls = [];
  harness.context.subscribePlatformCapability('wallpaperEngine', function(available) { calls.push(available); });
  assert.deepEqual(calls, [false]);
});
