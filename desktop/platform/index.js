'use strict';

function createPlatform(options = {}) {
  const nodePlatform = String(options.nodePlatform || process.platform);
  if (nodePlatform === 'win32') {
    return require('./windows')({
      app: options.app,
      appIcon: options.appIcon,
      appUserModelId: options.appUserModelId,
      desktopMode: options.desktopMode,
      shortcuts: options.shortcuts,
    });
  }
  if (nodePlatform === 'darwin') {
    return require('./macos')({
      app: options.app,
      globalShortcut: options.globalShortcut,
      Menu: options.Menu,
      onShortcutAction: options.onShortcutAction,
    });
  }
  const error = new Error(`Mineradio does not support platform: ${nodePlatform}`);
  error.code = 'MINERADIO_UNSUPPORTED_PLATFORM';
  throw error;
}

module.exports = {
  createPlatform,
};
