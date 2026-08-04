'use strict';

const {
  PLATFORM_CAPABILITY_KEYS,
  createCapabilities,
  isCapabilityName,
} = require('./capabilities');

const SUPPORTED_NODE_PLATFORMS = new Set(['win32', 'darwin']);

function unsupportedResult(nodePlatform, capability, operation = '') {
  if (!isCapabilityName(capability)) {
    throw new Error(`Unknown platform capability: ${String(capability || '')}`);
  }
  const status = {
    supported: false,
    active: false,
    enabled: false,
    interactive: false,
    platform: nodePlatform,
    capability,
    lastError: 'PLATFORM_CAPABILITY_UNSUPPORTED',
  };
  return {
    ok: false,
    unsupported: true,
    enabled: false,
    platform: nodePlatform,
    capability,
    operation: String(operation || ''),
    error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
    status,
  };
}

function assertDesktopModeService(service) {
  ['enable', 'disable', 'getStatus'].forEach((method) => {
    if (!service || typeof service[method] !== 'function') {
      throw new Error(`Platform desktopMode.${method} must be a function`);
    }
  });
}

function assertService(name, service, methods) {
  methods.forEach((method) => {
    if (!service || typeof service[method] !== 'function') {
      throw new Error(`Platform ${name}.${method} must be a function`);
    }
  });
}

function createPlatformContract(options = {}) {
  const id = String(options.id || '');
  const nodePlatform = String(options.nodePlatform || '');
  if (!id) throw new Error('Platform id is required');
  if (!SUPPORTED_NODE_PLATFORMS.has(nodePlatform)) {
    throw new Error(`Unsupported platform contract: ${nodePlatform || 'unknown'}`);
  }
  assertService('lifecycle', options.lifecycle, ['onReady', 'onActivate', 'cleanup']);
  assertService('runtime', options.runtime, ['chromiumSwitches']);
  assertService('shortcuts', options.shortcuts, ['configure', 'cleanup']);
  assertService('window', options.window, [
    'mainOptions',
    'configureMainWindow',
    'desktopLyricsOptions',
    'configureDesktopLyricsWindow',
  ]);
  assertDesktopModeService(options.desktopMode);

  const capabilities = createCapabilities(options.capabilities);
  const lifecycle = Object.freeze({
    quitWhenAllWindowsClosed: options.lifecycle.quitWhenAllWindowsClosed === true,
    onReady: options.lifecycle.onReady,
    onActivate: options.lifecycle.onActivate,
    cleanup: options.lifecycle.cleanup,
  });
  const window = Object.freeze({
    mainOptions: options.window.mainOptions,
    configureMainWindow: options.window.configureMainWindow,
    desktopLyricsOptions: options.window.desktopLyricsOptions,
    configureDesktopLyricsWindow: options.window.configureDesktopLyricsWindow,
  });
  const runtime = Object.freeze({
    chromiumSwitches: options.runtime.chromiumSwitches,
  });
  const shortcuts = Object.freeze({
    configure: options.shortcuts.configure,
    cleanup: options.shortcuts.cleanup,
  });
  const desktopMode = Object.freeze({
    enable: options.desktopMode.enable,
    disable: options.desktopMode.disable,
    getStatus: options.desktopMode.getStatus,
  });

  return Object.freeze({
    id,
    nodePlatform,
    capabilities,
    lifecycle,
    runtime,
    shortcuts,
    window,
    desktopMode,
    supports(capability) {
      if (!isCapabilityName(capability)) return false;
      return capabilities[capability] === true;
    },
    unsupported(capability, operation) {
      return unsupportedResult(nodePlatform, capability, operation);
    },
    snapshot() {
      return {
        ok: true,
        platform: nodePlatform,
        platformId: id,
        capabilities: { ...capabilities },
      };
    },
  });
}

module.exports = {
  PLATFORM_CAPABILITY_KEYS,
  createPlatformContract,
  unsupportedResult,
};
