'use strict';

const { createPlatformContract, unsupportedResult } = require('../contract');

module.exports = function createMacosPlatform() {
  const desktopModeUnsupported = () => unsupportedResult('darwin', 'fullDesktopMode');
  return createPlatformContract({
    id: 'macos',
    nodePlatform: 'darwin',
    capabilities: {
      fullDesktopMode: false,
      wallpaperEngine: false,
      tray: false,
    },
    quitWhenAllWindowsClosed: false,
    desktopMode: {
      enable: desktopModeUnsupported,
      disable: desktopModeUnsupported,
      getStatus: desktopModeUnsupported,
    },
  });
};
