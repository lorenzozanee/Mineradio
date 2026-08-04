'use strict';

const path = require('path');
const { signWindowsFile } = require('./signing');

function readWindowsTargetNames(context) {
  if (!context || !(context.platformToTargets instanceof Map)) {
    throw new Error('Windows artifact signing requires electron-builder target metadata.');
  }
  for (const [platform, targets] of context.platformToTargets) {
    if (!platform || platform.nodeName !== 'win32') continue;
    if (!(targets instanceof Map)) throw new Error('Windows artifact signing received invalid target metadata.');
    return Array.from(targets.keys());
  }
  return [];
}

async function signWindowsArtifacts(context, options = {}) {
  const platform = options.platform || process.platform;
  const sign = options.sign || signWindowsFile;
  if (!context || !Array.isArray(context.artifactPaths)) return [];
  if (platform !== 'win32') return [];
  const targetNames = options.targetNames || readWindowsTargetNames(context);
  if (!targetNames.includes('nsis')) return [];
  const installers = context.artifactPaths.filter(function(filePath) {
    return path.extname(filePath).toLowerCase() === '.exe';
  });
  if (installers.length !== 1) throw new Error(`Expected exactly one Windows NSIS installer, found ${installers.length}.`);
  sign(path.resolve(installers[0]));
  return [];
}

module.exports = signWindowsArtifacts;
module.exports.readWindowsTargetNames = readWindowsTargetNames;
module.exports.signWindowsArtifacts = signWindowsArtifacts;
