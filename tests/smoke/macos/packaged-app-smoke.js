'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertCleanRuntimeOutput,
  assertReadyStartup,
  createSmokeEnvironment,
  createSmokePaths,
  removeOwnedSmokeDirectory,
  runBoundedProcess,
  writeCacheSettings,
} = require('./main-entry-smoke');

const DEFAULT_TIMEOUT_MS = 30000;

function skip(reason) {
  return { skipped: true, reason };
}

function packagedExecutablePath(appPath) {
  const executableName = path.basename(appPath, '.app');
  return path.join(appPath, 'Contents', 'MacOS', executableName);
}

function defaultPackagedAppPath(repoRoot) {
  const explicit = String(process.env.MINERADIO_MACOS_PACKAGED_APP || '').trim();
  if (explicit) return path.resolve(explicit);
  return path.join(repoRoot, 'dist-macos', 'mac-arm64', 'Mineradio.app');
}

function resolvePackagedAppPrerequisite(options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const existsSync = options.existsSync || fs.existsSync;
  if (platform !== 'darwin') return skip(`macOS packaged-app smoke requires darwin; current platform is ${platform}.`);
  if (arch !== 'arm64') return skip(`macOS packaged-app smoke requires arm64; current architecture is ${arch}.`);
  if (!options.appPath || !existsSync(packagedExecutablePath(options.appPath))) {
    return skip('macOS packaged-app smoke requires a built arm64 app; run npm run build:mac:unsigned first.');
  }
  return { skipped: false, appPath: options.appPath };
}

function inspectPackagedApp(appPath, dependencies = {}) {
  const existsSync = dependencies.existsSync || fs.existsSync;
  const execFileSync = dependencies.execFileSync || childProcess.execFileSync;
  const executable = packagedExecutablePath(appPath);
  if (!existsSync(executable)) return { ok: false, reason: 'Packaged application executable is missing.' };
  let output;
  try {
    output = execFileSync('lipo', ['-archs', executable], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_) {
    return { ok: false, reason: 'Packaged application architecture could not be verified.' };
  }
  const architectures = String(output || '').trim().split(/\s+/).filter(Boolean);
  if (architectures.length !== 1 || architectures[0] !== 'arm64') {
    return { ok: false, reason: `Packaged application must be arm64-only; found ${architectures.join(', ') || 'none'}.` };
  }
  return { ok: true, executable, architectures };
}

function assertCleanPackagedRuntimeOutput(stderr) {
  assertCleanRuntimeOutput(stderr);
  if (/NSCameraUseContinuityCameraDeviceType/.test(String(stderr || ''))) {
    throw new Error('Packaged helper is missing its Continuity Camera usage declaration.');
  }
}

async function runMacosPackagedAppSmoke(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..', '..'));
  const appPath = path.resolve(options.appPath || defaultPackagedAppPath(repoRoot));
  const prerequisite = resolvePackagedAppPrerequisite({ appPath });
  if (prerequisite.skipped) return prerequisite;
  const packaged = inspectPackagedApp(appPath);
  if (!packaged.ok) return skip(packaged.reason);

  const paths = createSmokePaths({ parent: options.tempParent, runtimeName: options.runtimeName });
  try {
    writeCacheSettings(paths);
    const result = await runBoundedProcess(packaged.executable, [], {
      cwd: repoRoot,
      env: createSmokeEnvironment(paths, {
        runtimeName: paths.runtimeName,
        exitMs: options.exitMs || 1500,
      }),
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      detached: true,
    });
    if (result.timedOut) throw new Error(`macOS packaged-app smoke timed out after ${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms.`);
    if (result.error) throw result.error;
    if (result.code !== 0) throw new Error(`macOS packaged-app smoke exited with ${result.code}; stderr: ${result.stderr.slice(0, 1200)}`);
    assertCleanPackagedRuntimeOutput(result.stderr);
    const state = assertReadyStartup(paths);
    return {
      skipped: false,
      code: result.code,
      state,
      stdout: result.stdout,
      stderr: result.stderr,
      executable: packaged.executable,
      architectures: packaged.architectures,
    };
  } finally {
    if (!options.keepArtifacts) removeOwnedSmokeDirectory(paths);
  }
}

module.exports = {
  assertCleanPackagedRuntimeOutput,
  defaultPackagedAppPath,
  inspectPackagedApp,
  packagedExecutablePath,
  resolvePackagedAppPrerequisite,
  runMacosPackagedAppSmoke,
};

if (require.main === module) {
  runMacosPackagedAppSmoke()
    .then(result => {
      if (result.skipped) console.log(`[SKIP] ${result.reason}`);
      else console.log(`[OK] macOS packaged-app smoke passed (${result.architectures.join(', ')} app).`);
    })
    .catch(error => {
      console.error(`[FAIL] ${error && error.message || error}`);
      process.exitCode = 1;
    });
}
