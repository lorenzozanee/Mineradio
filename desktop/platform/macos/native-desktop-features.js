'use strict';

const { unsupportedResult } = require('../contract');

function unsupported(feature, operation) {
  return unsupportedResult('darwin', feature, operation);
}

class UnsupportedWallpaperEngineLibrary {
  installProtocol() { return unsupported('wallpaperEngine', 'installProtocol'); }
  list() { return Promise.resolve(unsupported('wallpaperEngine', 'list')); }
  getProjectDetails() { return Promise.resolve(unsupported('wallpaperEngine', 'getProjectDetails')); }
  addManualRoot() { return Promise.resolve(unsupported('wallpaperEngine', 'addManualRoot')); }
  addManualProjectFile() { return Promise.resolve(unsupported('wallpaperEngine', 'addManualProjectFile')); }
  removeManualRoot() { return Promise.resolve(unsupported('wallpaperEngine', 'removeManualRoot')); }
  dispose() { return unsupported('wallpaperEngine', 'dispose'); }
}

class UnsupportedWallpaperEngineRuntime {
  constructor() {
    this.active = null;
    this.pending = null;
  }

  getStatus() { return { ...unsupported('wallpaperEngine', 'getStatus'), active: false, pending: false }; }
  probe() { return Promise.resolve(unsupported('wallpaperEngine', 'probe')); }
  start() { return Promise.resolve(unsupported('wallpaperEngine', 'start')); }
  stop() { return Promise.resolve(unsupported('wallpaperEngine', 'stop')); }
  confirmCaptureReady() { return Promise.resolve(unsupported('wallpaperEngine', 'confirmCaptureReady')); }
  refreshActiveSource() { return Promise.resolve(unsupported('wallpaperEngine', 'refreshActiveSource')); }
  embedActiveWindow() { return Promise.resolve(unsupported('wallpaperEngine', 'embedActiveWindow')); }
  activateDwmSurface() { return Promise.resolve(unsupported('wallpaperEngine', 'activateDwmSurface')); }
  getDwmGlassCaptureSource() { return Promise.resolve(unsupported('wallpaperEngine', 'getDwmGlassCaptureSource')); }
  updateDwmDesktopIconLayering() { return Promise.resolve(unsupported('wallpaperEngine', 'updateDwmDesktopIconLayering')); }
  updateGlassSurface() { return unsupported('wallpaperEngine', 'updateGlassSurface'); }
  noteHostPointerActivity() { return unsupported('wallpaperEngine', 'noteHostPointerActivity'); }
  revealWorkshop() { return Promise.resolve(unsupported('wallpaperEngine', 'revealWorkshop')); }
  dispose() { return Promise.resolve(unsupported('wallpaperEngine', 'dispose')); }
}

class UnsupportedFullDesktopModeRuntime {
  getStatus(reason) {
    return {
      ...unsupported('fullDesktopMode', String(reason || 'getStatus')),
      enabled: false,
      interactive: false,
      coexisting: false,
      iconShapeActive: false,
    };
  }

  enable() { return Promise.resolve(unsupported('fullDesktopMode', 'enable')); }
  disable() { return Promise.resolve(unsupported('fullDesktopMode', 'disable')); }
  reconcile() { return Promise.resolve(unsupported('fullDesktopMode', 'reconcile')); }
  setInteractive() { return Promise.resolve(unsupported('fullDesktopMode', 'setInteractive')); }
  toggleInteractive() { return Promise.resolve(unsupported('fullDesktopMode', 'toggleInteractive')); }
  requestKeyboardFocus() { return Promise.resolve(unsupported('fullDesktopMode', 'requestKeyboardFocus')); }
  setDesktopIconsVisible() { return Promise.resolve(unsupported('fullDesktopMode', 'setDesktopIconsVisible')); }
  setSoftwareInteractionLocked() { return Promise.resolve(unsupported('fullDesktopMode', 'setSoftwareInteractionLocked')); }
  ensureIconLayerOrder() { return Promise.resolve(unsupported('fullDesktopMode', 'ensureIconLayerOrder')); }
  updateIconShields() { return Promise.resolve(unsupported('fullDesktopMode', 'updateIconShields')); }
  updatePointerRoute() { return Promise.resolve(unsupported('fullDesktopMode', 'updatePointerRoute')); }
  dispose() { return Promise.resolve(unsupported('fullDesktopMode', 'dispose')); }
}

function registerWallpaperEngineScheme() {
  return unsupported('wallpaperEngine', 'registerScheme');
}

module.exports = {
  FullDesktopModeRuntime: UnsupportedFullDesktopModeRuntime,
  WallpaperEngineLibrary: UnsupportedWallpaperEngineLibrary,
  WallpaperEngineRuntime: UnsupportedWallpaperEngineRuntime,
  registerWallpaperEngineScheme,
};
