'use strict';

const fs = require('fs');
const path = require('path');
const { createPlatformContract } = require('../contract');
const systemMemory = require('./system-memory');
const windowsTray = require('./tray');

function successfulNoop() {
  return { ok: true };
}

function configureDesktopLyricsWindow(win) {
  if (!win || typeof win.setAlwaysOnTop !== 'function') return { ok: false, error: 'WINDOW_UNAVAILABLE' };
  try {
    win.setAlwaysOnTop(true, 'screen-saver');
    if (typeof win.setVisibleOnAllWorkspaces === 'function') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'WINDOW_CONFIGURATION_FAILED' };
  }
}

module.exports = function createWindowsPlatform(options = {}) {
  const shortcuts = options.shortcuts || {
    configure: () => ({ ok: true, results: [] }),
    cleanup: successfulNoop,
  };
  return createPlatformContract({
    id: 'windows',
    nodePlatform: 'win32',
    capabilities: {
      fullDesktopMode: true,
      wallpaperEngine: true,
      tray: true,
    },
    lifecycle: {
      quitWhenAllWindowsClosed: true,
      configureApp: () => {
        if (!options.app || typeof options.app.setAppUserModelId !== 'function') {
          return { ok: false, error: 'APP_USER_MODEL_ID_UNAVAILABLE' };
        }
        try {
          options.app.setAppUserModelId(String(options.appUserModelId || 'com.mineradio.desktop'));
          return { ok: true };
        } catch (_) {
          return { ok: false, error: 'APP_USER_MODEL_ID_CONFIGURATION_FAILED' };
        }
      },
      onReady: successfulNoop,
      onActivate: successfulNoop,
      cleanup: successfulNoop,
    },
    runtime: {
      caseInsensitivePaths: true,
      chromiumSwitches: () => [['use-angle', 'd3d11']],
      defaultCacheRoot: userDataPath => {
        const dDrive = 'D:\\';
        return fs.existsSync(dDrive)
          ? path.join(dDrive, 'MineradioCache')
          : path.join(userDataPath, 'cache');
      },
    },
    shortcuts,
    systemMemory,
    window: {
      mainOptions: () => options.appIcon ? { icon: options.appIcon } : {},
      configureMainWindow: successfulNoop,
      desktopLyricsOptions: () => ({}),
      configureDesktopLyricsWindow,
    },
    desktopMode: options.desktopMode,
    tray: windowsTray,
  });
};
