'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const USAGE_DESCRIPTIONS = Object.freeze({
  NSCameraUsageDescription: 'Mineradio 仅在你开启手势控制时使用摄像头。',
  NSCameraUseContinuityCameraDeviceType: true,
  NSMicrophoneUsageDescription: 'Mineradio 仅在你开启音频监测功能时使用麦克风。',
});

function writePlistValue(plistPath, key, value, run = execFileSync) {
  const type = typeof value === 'boolean' ? '-bool' : '-string';
  const serialized = typeof value === 'boolean' ? String(value) : value;
  try {
    run('plutil', ['-replace', key, type, serialized, plistPath], { stdio: 'pipe' });
  } catch (_) {
    run('plutil', ['-insert', key, type, serialized, plistPath], { stdio: 'pipe' });
  }
}

function macosHelperInfoPlists(appOutDir, productFilename, dependencies = {}) {
  const readdirSync = dependencies.readdirSync || fs.readdirSync;
  const frameworks = path.join(appOutDir, `${productFilename}.app`, 'Contents', 'Frameworks');
  return readdirSync(frameworks, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      && entry.name.startsWith(`${productFilename} Helper`)
      && entry.name.endsWith('.app'))
    .map(entry => path.join(frameworks, entry.name, 'Contents', 'Info.plist'))
    .sort();
}

function patchMacosHelperUsageDescriptions(context, dependencies = {}) {
  if (!context || context.electronPlatformName !== 'darwin') return [];
  const productFilename = context.packager.appInfo.productFilename;
  const plists = macosHelperInfoPlists(context.appOutDir, productFilename, dependencies);
  if (!plists.length) throw new Error('No macOS Electron helper Info.plist files were found.');
  for (const plistPath of plists) {
    for (const [key, value] of Object.entries(USAGE_DESCRIPTIONS)) {
      writePlistValue(plistPath, key, value, dependencies.run);
    }
  }
  return plists;
}

module.exports = patchMacosHelperUsageDescriptions;
module.exports.macosHelperInfoPlists = macosHelperInfoPlists;
module.exports.patchMacosHelperUsageDescriptions = patchMacosHelperUsageDescriptions;
module.exports.USAGE_DESCRIPTIONS = USAGE_DESCRIPTIONS;
module.exports.writePlistValue = writePlistValue;
