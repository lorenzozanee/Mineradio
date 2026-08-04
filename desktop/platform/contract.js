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
  assertService('lifecycle', options.lifecycle, ['configureApp', 'onReady', 'onActivate', 'cleanup']);
  assertService('runtime', options.runtime, ['chromiumSwitches', 'defaultCacheRoot']);
  assertService('shortcuts', options.shortcuts, ['configure', 'cleanup']);
  assertService('systemMemory', options.systemMemory, [
    'setNativeTempPath',
    'getMemorySnapshot',
    'getMemorySnapshotExtended',
    'normalizeMask',
    'probeProcessElevation',
    'isProcessElevated',
    'purgeSystemMemorySmart',
    'trimAppWorkingSets',
  ]);
  assertService('window', options.window, [
    'mainOptions',
    'configureMainWindow',
    'desktopLyricsOptions',
    'configureDesktopLyricsWindow',
  ]);
  assertDesktopModeService(options.desktopMode);
  assertService('tray', options.tray, ['createOrUpdate', 'destroy', 'isAvailable']);

  const capabilities = createCapabilities(options.capabilities);
  const lifecycle = Object.freeze({
    quitWhenAllWindowsClosed: options.lifecycle.quitWhenAllWindowsClosed === true,
    configureApp: options.lifecycle.configureApp,
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
    caseInsensitivePaths: options.runtime.caseInsensitivePaths === true,
    chromiumSwitches: options.runtime.chromiumSwitches,
    defaultCacheRoot: options.runtime.defaultCacheRoot,
  });
  const shortcuts = Object.freeze({
    configure: options.shortcuts.configure,
    cleanup: options.shortcuts.cleanup,
  });
  const systemMemory = Object.freeze({
    MEMORY_MASK_DEFAULT: Number(options.systemMemory.MEMORY_MASK_DEFAULT) || 0,
    SYSTEM_PURGE_AVAILABLE: options.systemMemory.SYSTEM_PURGE_AVAILABLE === true,
    SYSTEM_PURGE_ENABLED: options.systemMemory.SYSTEM_PURGE_ENABLED === true,
    setNativeTempPath: options.systemMemory.setNativeTempPath,
    getMemorySnapshot: options.systemMemory.getMemorySnapshot,
    getMemorySnapshotExtended: options.systemMemory.getMemorySnapshotExtended,
    normalizeMask: options.systemMemory.normalizeMask,
    probeProcessElevation: options.systemMemory.probeProcessElevation,
    isProcessElevated: options.systemMemory.isProcessElevated,
    purgeSystemMemorySmart: options.systemMemory.purgeSystemMemorySmart,
    trimAppWorkingSets: options.systemMemory.trimAppWorkingSets,
  });
  const desktopMode = Object.freeze({
    enable: options.desktopMode.enable,
    disable: options.desktopMode.disable,
    getStatus: options.desktopMode.getStatus,
  });
  const tray = Object.freeze({
    createOrUpdate: options.tray.createOrUpdate,
    destroy: options.tray.destroy,
    isAvailable: options.tray.isAvailable,
  });

  return Object.freeze({
    id,
    nodePlatform,
    capabilities,
    lifecycle,
    runtime,
    shortcuts,
    systemMemory,
    window,
    desktopMode,
    tray,
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
