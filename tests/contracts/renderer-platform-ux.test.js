'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const capabilitySource = fs.readFileSync(
  path.resolve(__dirname, '../../public/js/modules/00-state/00-platform-capabilities.js'),
  'utf8'
);
const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../public/css/index.css'), 'utf8');

function createControl(disabled = false) {
  return {
    disabled,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || ''; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
    removeAttribute(name) { delete this.attributes[name]; },
  };
}

function createCapabilityElement(capability, controls) {
  return {
    hidden: false,
    attributes: { 'data-platform-capability': capability },
    getAttribute(name) { return this.attributes[name] || ''; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelectorAll(selector) {
      assert.equal(selector, 'button, input, select, textarea');
      return controls;
    },
    matches(selector) {
      return selector === 'button, input, select, textarea' && controls.includes(this);
    },
  };
}

function createHarness(payload) {
  const desktopModeButton = createControl(false);
  const wallpaperButton = createControl(false);
  const trayButton = createControl(true);
  const elements = [
    createCapabilityElement('fullDesktopMode', [desktopModeButton]),
    createCapabilityElement('wallpaperEngine', [wallpaperButton]),
    createCapabilityElement('tray', [trayButton]),
  ];
  const listeners = new Map();
  const documentElement = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
  const window = {
    desktopWindow: {
      getPlatformCapabilities: async () => payload,
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
      querySelectorAll(selector) {
        assert.equal(selector, '[data-platform-capability]');
        return elements;
      },
    },
    window,
  });
  vm.runInContext(capabilitySource, context, { filename: '00-platform-capabilities.js' });
  return {
    context,
    elements,
    documentElement,
    controls: { desktopModeButton, wallpaperButton, trayButton },
  };
}

test('renderer disables every unsupported capability control and its descendants on macOS', async () => {
  const harness = createHarness({
    ok: true,
    platform: 'darwin',
    platformId: 'macos',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
  });

  await harness.context.initializePlatformCapabilities();

  for (const element of harness.elements) {
    assert.equal(element.hidden, true);
    assert.equal(element.attributes['aria-hidden'], 'true');
  }
  assert.equal(harness.controls.desktopModeButton.disabled, true);
  assert.equal(harness.controls.wallpaperButton.disabled, true);
  assert.equal(harness.controls.trayButton.disabled, true);
  assert.equal(harness.controls.desktopModeButton.attributes['aria-disabled'], 'true');
  assert.equal(harness.documentElement.attributes['data-platform'], 'darwin');
});

test('renderer restores only controls disabled by capability gating when support is available', () => {
  const harness = createHarness({ ok: false });
  harness.context.applyPlatformCapabilities({
    ok: true,
    platform: 'darwin',
    platformId: 'macos',
    capabilities: { fullDesktopMode: false, wallpaperEngine: false, tray: false },
  });
  harness.context.applyPlatformCapabilities({
    ok: true,
    platform: 'win32',
    platformId: 'windows',
    capabilities: { fullDesktopMode: true, wallpaperEngine: true, tray: true },
  });

  for (const element of harness.elements) {
    assert.equal(element.hidden, false);
    assert.equal(element.attributes['aria-hidden'], 'false');
  }
  assert.equal(harness.controls.desktopModeButton.disabled, false);
  assert.equal(harness.controls.wallpaperButton.disabled, false);
  assert.equal(harness.controls.trayButton.disabled, true);
  assert.equal(harness.controls.desktopModeButton.attributes['aria-disabled'], 'false');
  assert.equal(harness.documentElement.attributes['data-platform'], 'win32');
});

test('invalid capability payloads fail closed and do not leave stale controls interactive', () => {
  const harness = createHarness({ ok: false });
  harness.context.applyPlatformCapabilities({
    ok: true,
    platform: 'darwin',
    platformId: 'macos',
    capabilities: { fullDesktopMode: true, wallpaperEngine: true, tray: true },
  });
  harness.context.applyPlatformCapabilities({ ok: false, capabilities: { fullDesktopMode: true } });

  assert.equal(harness.documentElement.attributes['data-platform-ready'], 'false');
  assert.equal(harness.controls.desktopModeButton.disabled, true);
  assert.equal(harness.controls.wallpaperButton.disabled, true);
  assert.equal(harness.controls.trayButton.disabled, true);
});

test('macOS CSS uses the capability snapshot to retain traffic-light clearance and suppress duplicate buttons', () => {
  assert.match(stylesheet, /html\[data-platform="darwin"\]\s+body\.desktop-shell\s+#desktop-titlebar\s*\{[^}]*padding-left:\s*86px/s);
  assert.match(stylesheet, /html\[data-platform="darwin"\]\s+body\.desktop-shell\s+\.desktop-window-controls\s+\[data-window-action\]\s*\{[^}]*display:\s*none\s*!important/s);
});
