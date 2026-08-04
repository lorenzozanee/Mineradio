'use strict';

const PLATFORM_CAPABILITY_KEYS = Object.freeze([
  'fullDesktopMode',
  'wallpaperEngine',
  'tray',
]);

function createCapabilities(values = {}) {
  const unknown = Object.keys(values).filter(key => !PLATFORM_CAPABILITY_KEYS.includes(key));
  if (unknown.length) {
    throw new Error(`Unknown platform capabilities: ${unknown.join(', ')}`);
  }
  const capabilities = {};
  PLATFORM_CAPABILITY_KEYS.forEach((key) => {
    capabilities[key] = values[key] === true;
  });
  return Object.freeze(capabilities);
}

function isCapabilityName(value) {
  return PLATFORM_CAPABILITY_KEYS.includes(String(value || ''));
}

module.exports = {
  PLATFORM_CAPABILITY_KEYS,
  createCapabilities,
  isCapabilityName,
};
