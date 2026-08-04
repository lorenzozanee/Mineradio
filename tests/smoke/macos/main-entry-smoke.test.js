'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  assertCleanRuntimeOutput,
  assertReadyStartup,
  createSmokePaths,
  createSmokeEnvironment,
  defaultElectronAppPath,
  hasRuntimeDependencies,
  inspectElectronApp,
  removeOwnedSmokeDirectory,
  resolveMacosSmokePrerequisite,
  runBoundedProcess,
} = require('./main-entry-smoke');

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-macos-smoke-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('macOS main-entry smoke skips clearly outside Apple Silicon macOS', () => {
  assert.deepEqual(
    resolveMacosSmokePrerequisite({ platform: 'linux', arch: 'x64', electronAppPath: '/missing' }),
    { skipped: true, reason: 'macOS main-entry smoke requires darwin; current platform is linux.' }
  );
  assert.deepEqual(
    resolveMacosSmokePrerequisite({ platform: 'darwin', arch: 'x64', electronAppPath: '/missing' }),
    { skipped: true, reason: 'macOS main-entry smoke requires arm64; current architecture is x64.' }
  );
});

test('macOS main-entry smoke skips clearly when Electron.app is absent', () => {
  assert.deepEqual(
    resolveMacosSmokePrerequisite({
      platform: 'darwin',
      arch: 'arm64',
      electronAppPath: '/does/not/exist/Electron.app',
      existsSync: () => false,
    }),
    { skipped: true, reason: 'macOS main-entry smoke requires Electron.app; run npm install first.' }
  );
});

test('default Electron.app location stays within the supplied repository root', () => {
  assert.equal(
    defaultElectronAppPath('/workspace/Mineradio'),
    '/workspace/Mineradio/node_modules/electron/dist/Electron.app'
  );
});

test('Electron.app inspection requires its MacOS executable and an arm64 architecture', () => {
  const appPath = '/fixture/Electron.app';
  assert.deepEqual(
    inspectElectronApp(appPath, { existsSync: () => false }),
    { ok: false, reason: 'Electron.app executable is missing.' }
  );
  assert.deepEqual(
    inspectElectronApp(appPath, {
      existsSync: () => true,
      execFileSync: () => 'x86_64\n',
    }),
    { ok: false, reason: 'Electron.app is not arm64.' }
  );
  assert.deepEqual(
    inspectElectronApp(appPath, {
      existsSync: () => true,
      execFileSync: () => 'x86_64 arm64\n',
    }),
    { ok: true, executable: '/fixture/Electron.app/Contents/MacOS/Electron', architectures: ['x86_64', 'arm64'] }
  );
});

test('Electron.app inspection reports an unverifiable architecture without assuming compatibility', () => {
  const result = inspectElectronApp('/fixture/Electron.app', {
    existsSync: () => true,
    execFileSync: () => { throw new Error('lipo missing'); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'Electron.app architecture could not be verified.');
});

test('owned smoke paths are unique, private, and constrained below one mkdtemp root', (t) => {
  const parent = makeRoot(t);
  const paths = createSmokePaths({ parent, mkdtempSync: fs.mkdtempSync, mkdirSync: fs.mkdirSync });
  const children = [paths.home, paths.tmp, paths.userData, paths.cacheRoot, paths.sessionData];
  assert.equal(path.dirname(paths.root), parent);
  assert.match(path.basename(paths.root), /^mineradio-macos-smoke-/);
  children.forEach(child => {
    assert.equal(child.startsWith(`${paths.root}${path.sep}`), true);
    assert.equal(fs.statSync(child).isDirectory(), true);
  });
  assert.notEqual(paths.home, paths.tmp);
  assert.notEqual(paths.userData, paths.cacheRoot);
});

test('isolated environment excludes inherited provider state and pins every writable root', (t) => {
  const parent = makeRoot(t);
  const paths = createSmokePaths({ parent, mkdtempSync: fs.mkdtempSync, mkdirSync: fs.mkdirSync });
  const environment = createSmokeEnvironment(paths, {
    runtimeName: 'MineradioMacSmoke-test',
    pathValue: '/usr/bin:/bin',
    inherited: {
      COOKIE_FILE: '/real/.cookie',
      SPOTIFY_TOKEN_FILE: '/real/token',
      HOME: '/real/home',
      PATH: '/real/path',
    },
  });
  assert.equal(environment.HOME, paths.home);
  assert.equal(environment.TMPDIR, paths.tmp);
  assert.equal(environment.MINERADIO_STARTUP_QA_USER_DATA, paths.userData);
  assert.equal(environment.MINERADIO_STARTUP_QA_HIDDEN, '1');
  assert.equal(environment.MINERADIO_STARTUP_QA_EXIT_MS, '1000');
  assert.equal(environment.PATH, '/usr/bin:/bin');
  assert.equal('COOKIE_FILE' in environment, false);
  assert.equal('SPOTIFY_TOKEN_FILE' in environment, false);
});

test('runtime dependency probe checks the app-root installation only', (t) => {
  const root = makeRoot(t);
  assert.equal(hasRuntimeDependencies(root), false);
  fs.mkdirSync(path.join(root, 'node_modules', 'NeteaseCloudMusicApi'), { recursive: true });
  assert.equal(hasRuntimeDependencies(root), true);
});

test('ready startup validation requires a ready state, no failed event, no error log, and owned paths', (t) => {
  const parent = makeRoot(t);
  const paths = createSmokePaths({ parent, mkdtempSync: fs.mkdtempSync, mkdirSync: fs.mkdirSync });
  const stateFile = path.join(paths.userData, 'startup-state.json');
  const state = {
    phase: 'ready',
    userData: paths.userData,
    sessionData: paths.sessionData,
    events: [{ phase: 'module-loaded' }, { phase: 'ready' }],
  };
  fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
  assert.deepEqual(assertReadyStartup(paths), state);

  fs.writeFileSync(path.join(paths.userData, 'startup-error.log'), 'failure', 'utf8');
  assert.throws(() => assertReadyStartup(paths), /startup-error\.log/);
  fs.unlinkSync(path.join(paths.userData, 'startup-error.log'));

  fs.writeFileSync(stateFile, JSON.stringify({ ...state, events: [...state.events, { phase: 'failed' }] }), 'utf8');
  assert.throws(() => assertReadyStartup(paths), /failed startup event/);

  fs.writeFileSync(stateFile, JSON.stringify({ ...state, sessionData: '/outside/session' }), 'utf8');
  assert.throws(() => assertReadyStartup(paths), /escaped the owned smoke root/);
});

test('owned cleanup removes only the exact mkdtemp child and refuses an unrelated target', (t) => {
  const parent = makeRoot(t);
  const paths = createSmokePaths({ parent, mkdtempSync: fs.mkdtempSync, mkdirSync: fs.mkdirSync });
  const unrelated = path.join(parent, 'unrelated');
  fs.mkdirSync(unrelated);
  assert.throws(() => removeOwnedSmokeDirectory({ root: unrelated, parent }), /Refusing to remove/);
  removeOwnedSmokeDirectory(paths);
  assert.equal(fs.existsSync(paths.root), false);
  assert.equal(fs.existsSync(unrelated), true);
});

test('bounded process runner captures a clean exit without a timeout', async () => {
  const result = await runBoundedProcess(process.execPath, ['-e', 'process.stdout.write("ok")'], {
    timeoutMs: 2000,
    detached: false,
  });
  assert.equal(result.timedOut, false);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'ok');
});

test('bounded process runner terminates a timed-out process and reports the timeout', async () => {
  const result = await runBoundedProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    timeoutMs: 80,
    detached: false,
  });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.code, 0);
});

test('real smoke runner treats early platform IPC disposal as a failure', async () => {
  assert.doesNotThrow(function() { assertCleanRuntimeOutput('[StartupWindow] visible'); });
  assert.throws(function() {
    assertCleanRuntimeOutput("Error: No handler registered for 'mineradio-platform-capabilities'");
  }, /disposed before the renderer stopped/);
});
