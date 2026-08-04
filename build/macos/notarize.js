'use strict';

const fs = require('fs');
const path = require('path');

const UNSIGNED_LOCAL_BUILD = '1';
const REQUIRED_CREDENTIALS = [
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER'
];

function readNotarizationCredentials(env, fileExists = fs.existsSync) {
  const missing = REQUIRED_CREDENTIALS.filter(function(name) {
    return !String(env[name] || '').trim();
  });
  if (missing.length) {
    throw new Error(`macOS notarization credentials are incomplete: ${missing.join(', ')}`);
  }

  const appleApiKey = path.resolve(env.APPLE_API_KEY);
  if (!fileExists(appleApiKey)) {
    throw new Error(`APPLE_API_KEY does not point to a readable private key: ${appleApiKey}`);
  }

  return {
    appleApiKey,
    appleApiKeyId: env.APPLE_API_KEY_ID.trim(),
    appleApiIssuer: env.APPLE_API_ISSUER.trim()
  };
}

async function notarizeMacApp(context, dependencies = {}) {
  const env = dependencies.env || process.env;
  const logger = dependencies.logger || console;
  const fileExists = dependencies.fileExists || fs.existsSync;

  if (context.electronPlatformName !== 'darwin') return;

  if (env.MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD === UNSIGNED_LOCAL_BUILD) {
    if (env.CI === 'true') {
      throw new Error('Unsigned macOS builds are not permitted in CI.');
    }
    logger.warn('  • skipping notarization for explicitly unsigned local macOS build');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  if (!fileExists(appPath)) {
    throw new Error(`Signed macOS application was not found: ${appPath}`);
  }

  const credentials = readNotarizationCredentials(env, fileExists);
  const notarize = dependencies.notarize || require('@electron/notarize').notarize;
  logger.log(`  • notarizing signed macOS application  app=${appName}.app`);
  await notarize({
    appPath,
    ...credentials
  });
}

module.exports = notarizeMacApp;
module.exports.notarizeMacApp = notarizeMacApp;
module.exports.readNotarizationCredentials = readNotarizationCredentials;
module.exports.REQUIRED_CREDENTIALS = REQUIRED_CREDENTIALS;
