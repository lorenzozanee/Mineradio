'use strict';

function createPlatform(options = {}) {
  const nodePlatform = String(options.nodePlatform || process.platform);
  if (nodePlatform === 'win32') {
    return require('./windows')({ desktopMode: options.desktopMode });
  }
  if (nodePlatform === 'darwin') {
    return require('./macos')();
  }
  const error = new Error(`Mineradio does not support platform: ${nodePlatform}`);
  error.code = 'MINERADIO_UNSUPPORTED_PLATFORM';
  throw error;
}

module.exports = {
  createPlatform,
};
