'use strict';

const { createPlatformContract } = require('../contract');

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
      onReady: successfulNoop,
      onActivate: successfulNoop,
      cleanup: successfulNoop,
    },
    window: {
      mainOptions: () => ({}),
      configureMainWindow: successfulNoop,
      desktopLyricsOptions: () => ({}),
      configureDesktopLyricsWindow,
    },
    desktopMode: options.desktopMode,
  });
};
