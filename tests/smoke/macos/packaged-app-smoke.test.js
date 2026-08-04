'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  assertCleanPackagedRuntimeOutput,
  defaultPackagedAppPath,
  inspectPackagedApp,
  packagedExecutablePath,
  resolvePackagedAppPrerequisite,
} = require('./packaged-app-smoke');

test('packaged app executable is derived from the app bundle name', function() {
  assert.equal(
    packagedExecutablePath('/fixture/Custom Radio.app'),
    path.join('/fixture/Custom Radio.app', 'Contents', 'MacOS', 'Custom Radio')
  );
});

test('default packaged app remains below the supplied repository root', function() {
  const appPath = defaultPackagedAppPath('/fixture/repository');
  assert.equal(appPath, path.join('/fixture/repository', 'dist-macos', 'mac-arm64', 'Mineradio.app'));
});

test('packaged app prerequisite skips unsupported hosts and missing builds', function() {
  assert.match(resolvePackagedAppPrerequisite({
    platform: 'win32',
    arch: 'x64',
    appPath: '/fixture/Mineradio.app',
  }).reason, /requires darwin/);
  assert.match(resolvePackagedAppPrerequisite({
    platform: 'darwin',
    arch: 'x64',
    appPath: '/fixture/Mineradio.app',
  }).reason, /requires arm64/);
  assert.match(resolvePackagedAppPrerequisite({
    platform: 'darwin',
    arch: 'arm64',
    appPath: '/fixture/Mineradio.app',
    existsSync: function() { return false; },
  }).reason, /requires a built arm64 app/);
});

test('packaged app inspection requires one arm64 architecture', function() {
  const missing = inspectPackagedApp('/fixture/Mineradio.app', {
    existsSync: function() { return false; },
  });
  assert.equal(missing.ok, false);

  const universal = inspectPackagedApp('/fixture/Mineradio.app', {
    existsSync: function() { return true; },
    execFileSync: function() { return 'x86_64 arm64\n'; },
  });
  assert.equal(universal.ok, false);
  assert.match(universal.reason, /arm64-only/);

  const arm64 = inspectPackagedApp('/fixture/Mineradio.app', {
    existsSync: function() { return true; },
    execFileSync: function() { return 'arm64\n'; },
  });
  assert.equal(arm64.ok, true);
  assert.deepEqual(arm64.architectures, ['arm64']);
});

test('packaged app inspection does not infer compatibility when lipo fails', function() {
  const result = inspectPackagedApp('/fixture/Mineradio.app', {
    existsSync: function() { return true; },
    execFileSync: function() { throw new Error('lipo failed'); },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /could not be verified/);
});

test('packaged runtime output rejects permission and IPC shutdown regressions', function() {
  assert.doesNotThrow(function() { assertCleanPackagedRuntimeOutput(''); });
  assert.throws(function() {
    assertCleanPackagedRuntimeOutput('Add NSCameraUseContinuityCameraDeviceType to your Info.plist');
  }, /Continuity Camera/);
  assert.throws(function() {
    assertCleanPackagedRuntimeOutput("No handler registered for 'mineradio-platform-capabilities'");
  }, /disposed before the renderer stopped/);
});
