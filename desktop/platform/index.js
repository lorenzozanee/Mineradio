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

function loadNativeDesktopFeatures(options = {}) {
  const nodePlatform = String(options.nodePlatform || process.platform);
  const load = options.load || require;
  if (nodePlatform === 'win32') {
    return {
      ...load('../wallpaper-engine-library'),
      ...load('../wallpaper-engine-runtime'),
      ...load('../full-desktop-mode-runtime'),
    };
  }
  if (nodePlatform === 'darwin') return load('./macos/native-desktop-features');
  throw new Error(`Unsupported native desktop feature platform: ${nodePlatform || 'unknown'}`);
}

function getLoginWindowIcon() {
  if (process.platform === 'darwin') return null;
  return path.join(__dirname, '..', '..', 'build', 'icon.ico');
}

module.exports = {
  createPlatform,
  loadNativeDesktopFeatures,
  getLoginWindowIcon,
};
