'use strict';

/**
 * macOS menu-bar status item (NSStatusItem via Electron Tray).
 *
 * Implements the platform tray-service contract for macOS:
 *   - createOrUpdate(options)  → { ok: true } | { ok: false, error }
 *   - destroy()                → { ok: true }
 *   - isAvailable()            → boolean
 *
 * Does NOT expose Windows-only menu items (exit-full-desktop-mode etc.).
 * Dock activation is handled by the lifecycle service, not by this module.
 */

let tray = null;
let statusItemState = null;

function isAvailable() {
  return true;
}

function createOrUpdate(options = {}) {
  if (typeof options !== 'object' || options === null) {
    return { ok: false, error: 'STATUS_ITEM_INVALID_OPTIONS' };
  }

  const appName = String(options.appName || 'Mineradio');
  const onShow = typeof options.onShow === 'function' ? options.onShow : null;
  const onQuit = typeof options.onQuit === 'function' ? options.onQuit : null;

  // Lazy-require Electron so this module is testable without a full Electron runtime.
  const electron = safeRequireElectron();
  if (!electron) {
    return { ok: false, error: 'STATUS_ITEM_ELECTRON_UNAVAILABLE' };
  }

  const { Tray, Menu, nativeImage } = electron;

  try {
    if (!tray) {
      const icon = buildTemplateImage(nativeImage);
      if (!icon) {
        return { ok: false, error: 'STATUS_ITEM_IMAGE_FAILED' };
      }
      tray = new Tray(icon);
      tray.setToolTip(appName);
      tray.on('mouse-down', () => {
        if (onShow) onShow();
      });
    }

    const template = [
      {
        label: `显示 ${appName}`,
        click: () => { if (onShow) onShow(); },
      },
      {
        label: `隐藏 ${appName}`,
        click: () => { if (onShow) onShow(); },
      },
      { type: 'separator' },
      {
        label: `退出 ${appName}`,
        click: () => { if (onQuit) onQuit(); },
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    tray.setContextMenu(menu);

    statusItemState = {
      appName,
      hasIcon: true,
      menuItemCount: template.length,
    };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'STATUS_ITEM_CREATE_FAILED' };
  }
}

function destroy() {
  if (tray) {
    try { tray.destroy(); } catch (_) { /* ignore */ }
    tray = null;
  }
  statusItemState = null;
  return { ok: true };
}

function safeRequireElectron() {
  try {
    return require('electron');
  } catch (_) {
    return null;
  }
}

function buildTemplateImage(nativeImage) {
  if (!nativeImage || typeof nativeImage.createFromDataURL !== 'function') return null;

  // 18x36 template image (18pt @2x for menu bar): a simple note/music glyph.
  // Drawn as a monochrome template — macOS applies the menu-bar-appropriate
  // colour automatically when isTemplate is set.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="36" viewBox="0 0 18 36">
    <g fill="black">
      <circle cx="4" cy="28" r="3"/>
      <circle cx="14" cy="26" r="3"/>
      <rect x="3" y="8" width="2" height="20" rx="1"/>
      <rect x="13" y="6" width="2" height="20" rx="1"/>
      <path d="M5 8 L15 6 L15 10 L5 12 Z" opacity="0.6"/>
    </g>
  </svg>`;

  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    if (!img || img.isEmpty()) return null;
    img.setTemplateImage(true);
    return img;
  } catch (_) {
    return null;
  }
}

module.exports = {
  isAvailable,
  createOrUpdate,
  destroy,
};
