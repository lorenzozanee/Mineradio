var platformCapabilityState = {
  ready: false,
  platform: 'unknown',
  platformId: 'unknown',
  capabilities: {}
};

function platformHasCapability(name) {
  return platformCapabilityState.ready === true
    && platformCapabilityState.capabilities[name] === true;
}

function applyPlatformCapabilityVisibility() {
  document.querySelectorAll('[data-platform-capability]').forEach(function (element) {
    var capability = element.getAttribute('data-platform-capability');
    var available = platformHasCapability(capability);
    element.hidden = !available;
    element.setAttribute('aria-hidden', available ? 'false' : 'true');
  });
}

function applyPlatformCapabilities(payload) {
  var value = payload && payload.ok === true ? payload : {};
  var capabilities = value.capabilities && typeof value.capabilities === 'object'
    ? value.capabilities
    : {};
  platformCapabilityState = {
    ready: value.ok === true,
    platform: String(value.platform || 'unknown'),
    platformId: String(value.platformId || 'unknown'),
    capabilities: Object.assign({}, capabilities)
  };
  document.documentElement.setAttribute('data-platform', platformCapabilityState.platform);
  document.documentElement.setAttribute('data-platform-ready', platformCapabilityState.ready ? 'true' : 'false');
  applyPlatformCapabilityVisibility();
  window.dispatchEvent(new CustomEvent('mineradio:platform-capabilities', {
    detail: {
      platform: platformCapabilityState.platform,
      platformId: platformCapabilityState.platformId,
      capabilities: Object.assign({}, platformCapabilityState.capabilities)
    }
  }));
  return platformCapabilityState;
}

function initializePlatformCapabilities() {
  var api = window.desktopWindow;
  if (!api || typeof api.getPlatformCapabilities !== 'function') {
    applyPlatformCapabilities(null);
    return Promise.resolve(platformCapabilityState);
  }
  return Promise.resolve(api.getPlatformCapabilities()).then(function (payload) {
    return applyPlatformCapabilities(payload);
  }).catch(function (error) {
    console.warn('[PlatformCapabilities]', error && error.message || error);
    return applyPlatformCapabilities(null);
  });
}

window.addEventListener('DOMContentLoaded', function () {
  initializePlatformCapabilities();
}, { once: true });
