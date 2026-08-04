'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SMOKE_PREFIX = 'mineradio-macos-smoke-';
const MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;

function skip(reason) {
  return { skipped: true, reason };
}

function isInside(root, candidate) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function electronExecutablePath(electronAppPath) {
  return path.join(electronAppPath, 'Contents', 'MacOS', 'Electron');
}

function inspectElectronApp(electronAppPath, dependencies = {}) {
  const existsSync = dependencies.existsSync || fs.existsSync;
  const execFileSync = dependencies.execFileSync || childProcess.execFileSync;
  const executable = electronExecutablePath(electronAppPath);
  if (!existsSync(executable)) return { ok: false, reason: 'Electron.app executable is missing.' };
  let output;
  try {
    output = execFileSync('lipo', ['-archs', executable], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_) {
    return { ok: false, reason: 'Electron.app architecture could not be verified.' };
  }
  const architectures = String(output || '').trim().split(/\s+/).filter(Boolean);
  if (!architectures.includes('arm64')) return { ok: false, reason: 'Electron.app is not arm64.' };
  return { ok: true, executable, architectures };
}

function resolveMacosSmokePrerequisite(options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const existsSync = options.existsSync || fs.existsSync;
  if (platform !== 'darwin') {
    return skip(`macOS main-entry smoke requires darwin; current platform is ${platform}.`);
  }
  if (arch !== 'arm64') {
    return skip(`macOS main-entry smoke requires arm64; current architecture is ${arch}.`);
  }
  if (!options.electronAppPath || !existsSync(electronExecutablePath(options.electronAppPath))) {
    return skip('macOS main-entry smoke requires Electron.app; run npm install first.');
  }
  return { skipped: false, electronAppPath: options.electronAppPath };
}

function createPrivateDirectory(mkdtempSync, mkdirSync, parent, prefix) {
  const directory = mkdtempSync(path.join(parent, prefix));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

function createSmokePaths(options = {}) {
  const mkdtempSync = options.mkdtempSync || fs.mkdtempSync;
  const mkdirSync = options.mkdirSync || fs.mkdirSync;
  const parent = path.resolve(options.parent || os.tmpdir());
  const runtimeName = options.runtimeName || `MineradioMacSmoke-${process.pid}-${Date.now()}`;
  const root = createPrivateDirectory(mkdtempSync, mkdirSync, parent, SMOKE_PREFIX);
  const home = createPrivateDirectory(mkdtempSync, mkdirSync, root, 'home-');
  const tmp = createPrivateDirectory(mkdtempSync, mkdirSync, root, 'tmp-');
  const userData = createPrivateDirectory(mkdtempSync, mkdirSync, root, 'user-data-');
  const cacheRoot = createPrivateDirectory(mkdtempSync, mkdirSync, root, 'cache-');
  const sessionData = path.join(cacheRoot, 'chromium', runtimeName);
  mkdirSync(sessionData, { recursive: true, mode: 0o700 });
  return { parent, root, home, tmp, userData, cacheRoot, sessionData, runtimeName };
}

function createSmokeEnvironment(paths, options = {}) {
  const inherited = options.inherited || process.env;
  const runtimeName = options.runtimeName || paths.runtimeName;
  const pathValue = options.pathValue || inherited.PATH || '/usr/bin:/bin';
  const environment = {
    PATH: pathValue,
    HOME: paths.home,
    TMPDIR: paths.tmp,
    TMP: paths.tmp,
    TEMP: paths.tmp,
    XDG_CACHE_HOME: path.join(paths.home, '.cache'),
    XDG_CONFIG_HOME: path.join(paths.home, '.config'),
    XDG_DATA_HOME: path.join(paths.home, '.local', 'share'),
    XDG_STATE_HOME: path.join(paths.home, '.local', 'state'),
    LANG: inherited.LANG || 'en_US.UTF-8',
    MINERADIO_RUNTIME_NAME: runtimeName,
    MINERADIO_APP_USER_MODEL_ID: 'com.mineradio.macos.smoke',
    MINERADIO_NO_DESKTOP_SHORTCUT: '1',
    MINERADIO_STARTUP_QA_USER_DATA: paths.userData,
    MINERADIO_STARTUP_QA_HIDDEN: '1',
    MINERADIO_STARTUP_QA_EXIT_MS: String(options.exitMs || 1000),
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  };
  [environment.XDG_CACHE_HOME, environment.XDG_CONFIG_HOME, environment.XDG_DATA_HOME, environment.XDG_STATE_HOME]
    .forEach(directory => fs.mkdirSync(directory, { recursive: true, mode: 0o700 }));
  return environment;
}

function writeCacheSettings(paths) {
  const file = path.join(paths.userData, 'cache-settings.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, rootPath: paths.cacheRoot }), 'utf8');
  return file;
}

function appendBounded(current, chunk) {
  if (current.length >= MAX_OUTPUT_BYTES) return current;
  return `${current}${String(chunk || '')}`.slice(0, MAX_OUTPUT_BYTES);
}

function assertCleanRuntimeOutput(stderr) {
  if (/No handler registered for 'mineradio-platform-capabilities'/.test(String(stderr || ''))) {
    throw new Error('Platform capability IPC was disposed before the renderer stopped.');
  }
}

function stopProcess(child, detached, signal) {
  if (!child || !Number.isInteger(child.pid) || child.pid <= 0) return;
  try {
    if (detached && process.platform !== 'win32') {
      process.kill(-child.pid, signal);
      return;
    }
  } catch (_) { }
  try { child.kill(signal); } catch (_) { }
}

function processGroupIsAlive(pid) {
  if (process.platform === 'win32' || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function runBoundedProcess(command, args, options = {}) {
  const timeoutMs = Math.max(100, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const detached = options.detached !== false;
  const spawn = options.spawn || childProcess.spawn;
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        detached,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(error);
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKill);
      try { child.stdout.destroy(); } catch (_) { }
      try { child.stderr.destroy(); } catch (_) { }
      resolve({ ...result, stdout, stderr, timedOut });
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      stopProcess(child, detached, 'SIGTERM');
    }, timeoutMs);
    const forceKill = setTimeout(() => {
      if (timedOut) stopProcess(child, detached, 'SIGKILL');
    }, timeoutMs + 2000);
    child.stdout.on('data', chunk => { stdout = appendBounded(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = appendBounded(stderr, chunk); });
    child.once('error', error => finish({ code: null, signal: null, error }));
    child.once('exit', (code, signal) => {
      setTimeout(() => {
        if (detached && process.platform !== 'win32' && processGroupIsAlive(child.pid)) {
          stopProcess(child, detached, 'SIGTERM');
        }
        finish({ code, signal, error: null });
      }, 100);
    });
  });
}

function assertReadyStartup(paths) {
  const stateFile = path.join(paths.userData, 'startup-state.json');
  if (!fs.existsSync(stateFile)) throw new Error('Startup state file was not written.');
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (_) {
    throw new Error('Startup state file is not valid JSON.');
  }
  const events = Array.isArray(state && state.events) ? state.events : [];
  if (!state || state.phase !== 'ready' || !events.some(event => event && event.phase === 'ready')) {
    throw new Error('Startup did not reach the ready state.');
  }
  if (events.some(event => event && event.phase === 'failed')) throw new Error('Startup state contains a failed startup event.');
  if (fs.existsSync(path.join(paths.userData, 'startup-error.log'))) throw new Error('Startup produced startup-error.log.');
  if (path.resolve(String(state.userData || '')) !== path.resolve(paths.userData)) {
    throw new Error('Startup userData escaped the owned smoke root.');
  }
  if (path.resolve(String(state.sessionData || '')) !== path.resolve(paths.sessionData)) {
    throw new Error('Startup sessionData escaped the owned smoke root.');
  }
  if (![paths.userData, paths.sessionData, paths.cacheRoot, paths.home, paths.tmp].every(candidate => isInside(paths.root, candidate))) {
    throw new Error('Smoke isolation paths escaped the owned smoke root.');
  }
  return state;
}

function removeOwnedSmokeDirectory(paths) {
  const root = path.resolve(paths && paths.root || '');
  const parent = path.resolve(paths && paths.parent || '');
  if (!root || !parent || path.dirname(root) !== parent || !/^mineradio-macos-smoke-[A-Za-z0-9]{6}$/.test(path.basename(root))) {
    throw new Error(`Refusing to remove unexpected macOS smoke path: ${root}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
}

function defaultElectronAppPath(repoRoot) {
  const explicit = String(process.env.MINERADIO_MACOS_SMOKE_ELECTRON_APP || '').trim();
  if (explicit) return path.resolve(explicit);
  return path.join(repoRoot, 'node_modules', 'electron', 'dist', 'Electron.app');
}

function hasRuntimeDependencies(repoRoot) {
  return fs.existsSync(path.join(repoRoot, 'node_modules', 'NeteaseCloudMusicApi'));
}

async function runMacosMainEntrySmoke(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..', '..'));
  const electronAppPath = path.resolve(options.electronAppPath || defaultElectronAppPath(repoRoot));
  const prerequisite = resolveMacosSmokePrerequisite({ electronAppPath });
  if (prerequisite.skipped) return prerequisite;
  const electron = inspectElectronApp(electronAppPath);
  if (!electron.ok) return skip(electron.reason);
  if (!hasRuntimeDependencies(repoRoot)) return skip('macOS main-entry smoke requires project runtime dependencies; run npm ci first.');

  const paths = createSmokePaths({ parent: options.tempParent, runtimeName: options.runtimeName });
  try {
    writeCacheSettings(paths);
    const result = await runBoundedProcess(electron.executable, [repoRoot], {
      cwd: repoRoot,
      env: createSmokeEnvironment(paths, {
        runtimeName: paths.runtimeName,
        exitMs: options.exitMs || 1000,
      }),
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      detached: true,
    });
    if (result.timedOut) throw new Error(`macOS main-entry smoke timed out after ${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms.`);
    if (result.error) throw result.error;
    if (result.code !== 0) throw new Error(`macOS main-entry smoke exited with ${result.code}; stderr: ${result.stderr.slice(0, 1200)}`);
    assertCleanRuntimeOutput(result.stderr);
    const state = assertReadyStartup(paths);
    return {
      skipped: false,
      code: result.code,
      state,
      stdout: result.stdout,
      stderr: result.stderr,
      electronArchitectures: electron.architectures,
    };
  } finally {
    if (!options.keepArtifacts) removeOwnedSmokeDirectory(paths);
  }
}

module.exports = {
  assertCleanRuntimeOutput,
  assertReadyStartup,
  createSmokeEnvironment,
  createSmokePaths,
  defaultElectronAppPath,
  hasRuntimeDependencies,
  inspectElectronApp,
  processGroupIsAlive,
  removeOwnedSmokeDirectory,
  resolveMacosSmokePrerequisite,
  runBoundedProcess,
  runMacosMainEntrySmoke,
  writeCacheSettings,
};

if (require.main === module) {
  runMacosMainEntrySmoke()
    .then(result => {
      if (result.skipped) console.log(`[SKIP] ${result.reason}`);
      else console.log(`[OK] macOS main-entry smoke passed (${result.electronArchitectures.join(', ')} Electron).`);
    })
    .catch(error => {
      console.error(`[FAIL] ${error && error.message || error}`);
      process.exitCode = 1;
    });
}
