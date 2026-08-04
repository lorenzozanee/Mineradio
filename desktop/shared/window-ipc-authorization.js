'use strict';

function isTrustedTopFrameSender(event, targetWindow, isTrustedUrl) {
  try {
    if (!event || !event.sender || !targetWindow || targetWindow.isDestroyed()) return false;
    if (!targetWindow.webContents || event.sender !== targetWindow.webContents || event.sender.isDestroyed()) return false;
    if (event.senderFrame && event.senderFrame.parent) return false;
    const sourceUrl = event.senderFrame && event.senderFrame.url || event.sender.getURL();
    return typeof isTrustedUrl === 'function' && isTrustedUrl(sourceUrl) === true;
  } catch (_) {
    return false;
  }
}

function createWindowIpcAuthorization(options = {}) {
  const getMainWindow = options.getMainWindow;
  const getOverlayWindow = options.getOverlayWindow;
  const isTrustedMainUrl = options.isTrustedMainUrl;
  const isTrustedOverlayUrl = options.isTrustedOverlayUrl;
  const overlayChannels = new Set(options.overlayChannels || []);
  if (typeof getMainWindow !== 'function' || typeof getOverlayWindow !== 'function') {
    throw new Error('Window IPC authorization requires window accessors');
  }

  function isTrustedMain(event) {
    return isTrustedTopFrameSender(event, getMainWindow(), isTrustedMainUrl);
  }

  function isTrustedOverlay(event) {
    return isTrustedTopFrameSender(event, getOverlayWindow(), isTrustedOverlayUrl);
  }

  return Object.freeze({
    isTrustedMain,
    isTrustedOverlay,
    authorize(event, channel) {
      if (overlayChannels.has(channel) && isTrustedOverlay(event)) return true;
      return isTrustedMain(event);
    },
  });
}

module.exports = {
  createWindowIpcAuthorization,
  isTrustedTopFrameSender,
};
