'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PRIVATE_FILE_PATTERNS = [
  /^\.cookie$/i,
  /^\.qq-cookie$/i,
  /^\.kugou-cookie$/i,
  /^\.qishui-/i,
  /^\.spotify-/i,
  /^\.env(?:\.|$)/i,
  /\.log$/i
];
const TEXT_FILE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.plist',
  '.txt',
  '.xml',
  '.yaml',
  '.yml'
]);

function listTree(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      result.push(fullPath);
      if (entry.isDirectory() && !entry.isSymbolicLink()) stack.push(fullPath);
    }
  }
  return result;
}

function findPrivatePaths(root) {
  return listTree(root).filter(function(filePath) {
    return PRIVATE_FILE_PATTERNS.some(function(pattern) {
      return pattern.test(path.basename(filePath));
    });
  });
}

function findAbsoluteUserPaths(root) {
  const matches = [];
  for (const filePath of listTree(root)) {
    if (!TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    if (/\/Users\/[^/\s"'\\]+/.test(source) || /[A-Za-z]:\\Users\\[^\\\s"'/]+/.test(source)) {
      matches.push(filePath);
    }
  }
  return matches;
}

function assertArm64Executable(executablePath, run = execFileSync) {
  const architectures = String(run('lipo', ['-archs', executablePath], { encoding: 'utf8' })).trim().split(/\s+/);
  if (architectures.length !== 1 || architectures[0] !== 'arm64') {
    throw new Error(`Expected an arm64-only executable, found: ${architectures.join(', ')}`);
  }
}

function assertPackagedContent(appPath) {
  const privatePaths = findPrivatePaths(appPath);
  if (privatePaths.length) {
    throw new Error(`Private runtime files were packaged:\n${privatePaths.join('\n')}`);
  }

  const absoluteUserPaths = findAbsoluteUserPaths(appPath);
  if (absoluteUserPaths.length) {
    throw new Error(`Absolute user paths were packaged:\n${absoluteUserPaths.join('\n')}`);
  }

  const appResources = path.join(appPath, 'Contents', 'Resources', 'app');
  const forbiddenBuildPaths = [
    path.join(appResources, 'build'),
    path.join(appResources, 'tests'),
    path.join(appResources, '.github')
  ];
  const packaged = forbiddenBuildPaths.filter(fs.existsSync);
  if (packaged.length) {
    throw new Error(`Build-only content was packaged:\n${packaged.join('\n')}`);
  }
}

function validateDmg(dmgPath, options = {}) {
  if (process.platform !== 'darwin') throw new Error('DMG validation must run on macOS.');
  if (process.arch !== 'arm64') throw new Error(`DMG validation requires an arm64 host, found ${process.arch}.`);
  if (!fs.existsSync(dmgPath)) throw new Error(`DMG was not found: ${dmgPath}`);

  const mountRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-dmg-'));
  const mountPoint = path.join(mountRoot, 'volume');
  fs.mkdirSync(mountPoint);

  try {
    execFileSync('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath], { stdio: 'inherit' });
    const appNames = fs.readdirSync(mountPoint).filter(function(name) { return name.endsWith('.app'); });
    if (appNames.length !== 1) {
      throw new Error(`Expected exactly one application in the DMG, found ${appNames.length}.`);
    }
    const applicationsLink = path.join(mountPoint, 'Applications');
    if (!fs.existsSync(applicationsLink)
        || !fs.lstatSync(applicationsLink).isSymbolicLink()
        || fs.readlinkSync(applicationsLink) !== '/Applications') {
      throw new Error('DMG does not contain an Applications link.');
    }

    const appPath = path.join(mountPoint, appNames[0]);
    const executableName = path.basename(appNames[0], '.app');
    assertArm64Executable(path.join(appPath, 'Contents', 'MacOS', executableName));
    assertPackagedContent(appPath);

    if (!options.unsigned) {
      execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
      execFileSync('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' });
      execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath], { stdio: 'inherit' });
    }
  } finally {
    try {
      execFileSync('hdiutil', ['detach', mountPoint], { stdio: 'inherit' });
    } finally {
      fs.rmSync(mountRoot, { recursive: true, force: true });
    }
  }
}

function main(argv) {
  const args = argv.slice(2);
  const unsigned = args.includes('--unsigned');
  const dmgPath = args.find(function(arg) { return arg !== '--unsigned'; });
  if (!dmgPath) throw new Error('Usage: node build/macos/validate-dmg.js [--unsigned] <path-to-dmg>');
  validateDmg(path.resolve(dmgPath), { unsigned });
  console.log(`Validated Mineradio arm64 DMG: ${path.resolve(dmgPath)}`);
}

if (require.main === module) main(process.argv);

module.exports = {
  assertArm64Executable,
  assertPackagedContent,
  findAbsoluteUserPaths,
  findPrivatePaths,
  validateDmg
};
