'use strict';

const {
  PLATFORM_CAPABILITY_KEYS,
  createCapabilities,
  isCapabilityName,
} = require('./capabilities');

const SUPPORTED_NODE_PLATFORMS = new Set(['win32', 'darwin']);

function unsupportedResult(nodePlatform, capability) {
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

function createPlatformContract(options = {}) {
  const id = String(options.id || '');
  const nodePlatform = String(options.nodePlatform || '');
  if (!id) throw new Error('Platform id is required');
  if (!SUPPORTED_NODE_PLATFORMS.has(nodePlatform)) {
    throw new Error(`Unsupported platform contract: ${nodePlatform || 'unknown'}`);
  }
  assertDesktopModeService(options.desktopMode);

  const capabilities = createCapabilities(options.capabilities);
  const lifecycle = Object.freeze({
    quitWhenAllWindowsClosed: options.quitWhenAllWindowsClosed === true,
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
    desktopMode,
    supports(capability) {
      if (!isCapabilityName(capability)) return false;
      return capabilities[capability] === true;
    },
    unsupported(capability) {
      return unsupportedResult(nodePlatform, capability);
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
