'use strict';

const { createPlatformContract } = require('../contract');

module.exports = function createWindowsPlatform(options = {}) {
  return createPlatformContract({
    id: 'windows',
    nodePlatform: 'win32',
    capabilities: {
      fullDesktopMode: true,
      wallpaperEngine: true,
      tray: true,
    },
    quitWhenAllWindowsClosed: true,
    desktopMode: options.desktopMode,
  });
};
