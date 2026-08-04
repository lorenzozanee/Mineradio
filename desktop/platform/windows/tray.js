'use strict';

/**
 * Windows system-tray service adapter.
 *
 * Wraps the existing main.js tray logic into the platform tray-service contract:
 *   - createOrUpdate(options)  → { ok: true } | { ok: false, error }
 *   - destroy()                → { ok: true }
 *   - isAvailable()            → boolean
 *
 * Preserves the existing Windows tray menu (Show, Exit Full Desktop Mode, Exit),
 * .ico icon, and close-to-tray behaviour unchanged.
 */

let tray = null;
let state = null;

function isAvailable() {
  return true;
}

function createOrUpdate(options = {}) {
  if (typeof options !== 'object' || options === null) {
    return { ok: false, error: 'TRAY_INVALID_OPTIONS' };
  }

  const electron = safeRequireElectron();
  if (!electron) {
    return { ok: false, error: 'TRAY_ELECTRON_UNAVAILABLE' };
  }

  const { Tray, Menu } = electron;
  const appName = String(options.appName || 'Mineradio');
  const iconPath = options.iconPath || null;
  const onShow = typeof options.onShow === 'function' ? options.onShow : null;
  const onQuit = typeof options.onQuit === 'function' ? options.onQuit : null;
  const fullDesktopEnabled = options.fullDesktopEnabled === true;
  const onExitFullDesktop = typeof options.onExitFullDesktop === 'function' ? options.onExitFullDesktop : null;

  try {
    if (!tray) {
      if (!iconPath) {
        return { ok: false, error: 'TRAY_ICON_MISSING' };
      }
      tray = new Tray(iconPath);
      tray.setToolTip(appName);
      tray.on('click', () => { if (onShow) onShow(); });
      tray.on('double-click', () => { if (onShow) onShow(); });
    }

    const menuItems = [
      { label: `显示 ${appName}`, click: () => { if (onShow) onShow(); } },
    ];

    if (fullDesktopEnabled) {
      menuItems.push({
        label: '退出完整桌面模式',
        click: () => { if (onExitFullDesktop) onExitFullDesktop(); },
      });
    }

    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: '退出',
      click: () => { if (onQuit) onQuit(); },
    });

    const menu = Menu.buildFromTemplate(menuItems);
    tray.setContextMenu(menu);

    state = { appName, hasIcon: true, fullDesktopEnabled, menuItemCount: menuItems.length };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'TRAY_CREATE_FAILED' };
  }
}

function destroy() {
  if (tray) {
    try { tray.destroy(); } catch (_) { /* ignore */ }
    tray = null;
  }
  state = null;
  return { ok: true };
}

function safeRequireElectron() {
  try {
    return require('electron');
  } catch (_) {
    return null;
  }
}

module.exports = {
  isAvailable,
  createOrUpdate,
  destroy,
};
