'use strict';

const path = require('path');
const { signWindowsFile } = require('./signing');

async function signWindowsArtifacts(context, options = {}) {
  const platform = options.platform || process.platform;
  const sign = options.sign || signWindowsFile;
  if (!context || !Array.isArray(context.artifactPaths)) return [];
  if (platform !== 'win32') return [];
  const installers = context.artifactPaths.filter(function(filePath) {
    return /-Setup\.exe$/i.test(path.basename(filePath));
  });
  if (installers.length === 0) return [];
  if (installers.length > 1) throw new Error(`Expected at most one Windows NSIS installer, found ${installers.length}.`);
  sign(path.resolve(installers[0]));
  return [];
}

module.exports = signWindowsArtifacts;
module.exports.signWindowsArtifacts = signWindowsArtifacts;
