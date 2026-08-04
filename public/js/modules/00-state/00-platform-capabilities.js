var platformCapabilityState = {
  ready: false,
  platform: 'unknown',
  platformId: 'unknown',
  capabilities: {}
};
var platformCapabilitySubscribers = [];

function platformHasCapability(name) {
  return platformCapabilityState.ready === true
    && platformCapabilityState.capabilities[name] === true;
}

function subscribePlatformCapability(name, callback) {
  if (typeof name !== 'string' || typeof callback !== 'function') return function () {};
  var subscriber = { name: name, callback: callback };
  platformCapabilitySubscribers.push(subscriber);
  if (platformCapabilityState.ready) callback(platformHasCapability(name), platformCapabilityState);
  return function () {
    var index = platformCapabilitySubscribers.indexOf(subscriber);
    if (index >= 0) platformCapabilitySubscribers.splice(index, 1);
  };
}

function notifyPlatformCapabilitySubscribers() {
  platformCapabilitySubscribers.slice().forEach(function (subscriber) {
    subscriber.callback(platformHasCapability(subscriber.name), platformCapabilityState);
  });
}

function platformCapabilityInteractiveElements(element) {
  var selector = 'button, input, select, textarea';
  var controls = [];
  if (element && typeof element.matches === 'function' && element.matches(selector)) controls.push(element);
  if (element && typeof element.querySelectorAll === 'function') {
    element.querySelectorAll(selector).forEach(function (control) { controls.push(control); });
  }
  return controls;
}

function setPlatformCapabilityControlState(control, available) {
  if (!control || typeof control.disabled !== 'boolean') return;
  if (!available) {
    if (!control.hasAttribute('data-platform-capability-disabled')) {
      control.setAttribute('data-platform-capability-disabled', control.disabled ? '1' : '0');
    }
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    return;
  }
  var previousDisabled = control.getAttribute('data-platform-capability-disabled');
  if (previousDisabled === '0' || previousDisabled === '1') {
    control.disabled = previousDisabled === '1';
    control.removeAttribute('data-platform-capability-disabled');
  }
  control.setAttribute('aria-disabled', control.disabled ? 'true' : 'false');
}

function applyPlatformCapabilityVisibility() {
  document.querySelectorAll('[data-platform-capability]').forEach(function (element) {
    var capability = element.getAttribute('data-platform-capability');
    var available = platformHasCapability(capability);
    element.hidden = !available;
    element.setAttribute('aria-hidden', available ? 'false' : 'true');
    platformCapabilityInteractiveElements(element).forEach(function (control) {
      setPlatformCapabilityControlState(control, available);
    });
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
  notifyPlatformCapabilitySubscribers();
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
