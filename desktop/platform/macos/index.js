'use strict';

const { createPlatformContract, unsupportedResult } = require('../contract');
const { installApplicationMenu } = require('./application-menu');
const { createMacosGlobalShortcutService } = require('./shortcuts');

function configureMainWindow(win) {
  if (!win || typeof win.setWindowButtonVisibility !== 'function') return { ok: true };
  try {
    win.setWindowButtonVisibility(true);
    return { ok: true };
  } catch (_) {
    return { ok: false, error: 'WINDOW_CONFIGURATION_FAILED' };
  }
}

function configureDesktopLyricsWindow(win) {
  if (!win || typeof win.setAlwaysOnTop !== 'function') return { ok: false, error: 'WINDOW_UNAVAILABLE' };
  try {
    win.setAlwaysOnTop(true, 'floating');
    if (typeof win.setVisibleOnAllWorkspaces === 'function') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    return { ok: true };
  } catch (_) {
    return { ok: false, error: 'WINDOW_CONFIGURATION_FAILED' };
  }
}

module.exports = function createMacosPlatform(options = {}) {
  const desktopModeUnsupported = operation => unsupportedResult('darwin', 'fullDesktopMode', operation);
  const shortcuts = createMacosGlobalShortcutService({
    globalShortcut: options.globalShortcut,
    onAction: options.onShortcutAction,
  });
  return createPlatformContract({
    id: 'macos',
    nodePlatform: 'darwin',
    capabilities: {
      fullDesktopMode: false,
      wallpaperEngine: false,
      tray: false,
    },
    lifecycle: {
      quitWhenAllWindowsClosed: false,
      onReady: () => installApplicationMenu(options),
      onActivate: () => {
        if (options.app && options.app.dock && typeof options.app.dock.show === 'function') {
          try {
            options.app.dock.show();
          } catch (_) {
            return { ok: false, error: 'DOCK_ACTIVATION_FAILED' };
          }
        }
        return { ok: true };
      },
      cleanup: () => ({ ok: true }),
    },
    runtime: {
      caseInsensitivePaths: false,
      chromiumSwitches: () => [],
    },
    shortcuts,
    window: {
      mainOptions: () => ({
        frame: true,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 18, y: 18 },
      }),
      configureMainWindow,
      desktopLyricsOptions: () => ({
        type: 'panel',
        hiddenInMissionControl: true,
      }),
      configureDesktopLyricsWindow,
    },
    desktopMode: {
      enable: () => desktopModeUnsupported('enable'),
      disable: () => desktopModeUnsupported('disable'),
      getStatus: () => desktopModeUnsupported('getStatus'),
    },
  });
};
