'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  readWindowsSigningConfig,
  resolveSignTool,
  signWindowsFile,
} = require('../../build/windows/signing');
const { signWindowsArtifacts } = require('../../build/windows/after-all-artifact-build');

test('formal Windows signing fails closed without complete protected credentials', function() {
  assert.throws(function() { readWindowsSigningConfig({}); }, /WINDOWS_CERTIFICATE_PATH/);
  assert.throws(function() {
    readWindowsSigningConfig({ WINDOWS_CERTIFICATE_PATH: 'relative/cert.pfx' }, function() { return true; });
  }, /absolute PFX/);
  assert.throws(function() {
    readWindowsSigningConfig({ WINDOWS_CERTIFICATE_PATH: '/fixture/missing.pfx' }, function() { return false; });
  }, /existing absolute PFX/);
  assert.throws(function() {
    readWindowsSigningConfig({ WINDOWS_CERTIFICATE_PATH: '/fixture/cert.pfx' }, function() { return true; });
  }, /WINDOWS_CERTIFICATE_PASSWORD/);
  assert.throws(function() {
    readWindowsSigningConfig({
      WINDOWS_CERTIFICATE_PATH: '/fixture/cert.pfx',
      WINDOWS_CERTIFICATE_PASSWORD: 'secret',
      WINDOWS_TIMESTAMP_URL: 'http://timestamp.invalid',
    }, function() { return true; });
  }, /HTTPS/);
  assert.throws(function() {
    readWindowsSigningConfig({
      WINDOWS_CERTIFICATE_PATH: '/fixture/cert.pfx',
      WINDOWS_CERTIFICATE_PASSWORD: 'secret',
      WINDOWS_TIMESTAMP_URL: 'https://user:password@timestamp.invalid',
    }, function() { return true; });
  }, /credential-free HTTPS/);
});

test('unsigned Windows builds require an explicit local opt-out and are forbidden in CI', function() {
  assert.deepEqual(readWindowsSigningConfig({ MINERADIO_ALLOW_UNSIGNED_WINDOWS_BUILD: '1' }), { unsigned: true });
  assert.throws(function() {
    readWindowsSigningConfig({ MINERADIO_ALLOW_UNSIGNED_WINDOWS_BUILD: '1', CI: 'true' });
  }, /not permitted in CI/);
});

test('Windows signing uses SHA-256 RFC 3161 timestamping and verifies Authenticode', function() {
  const calls = [];
  const existsSync = function() { return true; };
  const target = path.resolve('/fixture/Mineradio.exe');
  const result = signWindowsFile(target, {
    platform: 'win32',
    signTool: path.resolve('/fixture/signtool.exe'),
    existsSync,
    env: {
      WINDOWS_CERTIFICATE_PATH: path.resolve('/fixture/cert.pfx'),
      WINDOWS_CERTIFICATE_PASSWORD: 'fixture-secret',
    },
    run(command, args) { calls.push({ command, args }); },
  });
  assert.equal(result.unsigned, false);
  assert.deepEqual(calls[0].args.slice(0, 7), ['sign', '/fd', 'SHA256', '/tr', 'https://timestamp.digicert.com/', '/td', 'SHA256']);
  assert.deepEqual(calls[1].args, ['verify', '/pa', '/all', target]);
});

test('Windows signing rejects the wrong host platform and missing targets', function() {
  assert.throws(function() {
    signWindowsFile(path.resolve('/fixture/Mineradio.exe'), { platform: 'darwin' });
  }, /requires win32/);
  assert.throws(function() {
    signWindowsFile(path.resolve('/fixture/missing.exe'), {
      platform: 'win32',
      existsSync() { return false; },
    });
  }, /target is missing/);
});

test('SignTool resolution requires an absolute Windows SDK result', function() {
  assert.equal(resolveSignTool(function() { return 'C:\\Windows Kits\\signtool.exe'; }), 'C:\\Windows Kits\\signtool.exe');
  assert.throws(function() { resolveSignTool(function() { return ''; }); }, /not found/);
});

test('Windows afterPack injects resources before signing the main executable', function() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../build/after-pack.js'), 'utf8');
  assert.ok(source.indexOf('execFileSync(rceditPath') < source.indexOf('signWindowsFile(exePath)'));
  const packageJson = require('../../package.json');
  const internalBeta = require('../../electron-builder.internal-beta.json');
  assert.equal(packageJson.build.afterAllArtifactBuild, 'build/windows/after-all-artifact-build.js');
  assert.equal(internalBeta.afterAllArtifactBuild, 'build/windows/after-all-artifact-build.js');
  assert.match(packageJson.scripts['build:win'], /--publish never$/);
  assert.match(packageJson.scripts['build:win:dir'], /--publish never$/);
});

test('artifact hook ignores non-Windows builds and returns no duplicate artifacts', async function() {
  const calls = [];
  const result = await signWindowsArtifacts({ artifactPaths: ['/fixture/Mineradio-1.0.0-Setup.exe'] }, {
    platform: 'darwin',
    sign(filePath) { calls.push(filePath); },
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, []);
});

test('Windows directory builds need no installer signature', async function() {
  const calls = [];
  const result = await signWindowsArtifacts({ artifactPaths: ['/fixture/win-unpacked/Mineradio.exe'] }, {
    platform: 'win32',
    sign(filePath) { calls.push(filePath); },
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, []);
});

test('Windows artifact hook signs one NSIS installer without republishing it', async function() {
  const calls = [];
  const installer = path.resolve('/fixture/Mineradio-1.0.0-Setup.exe');
  const result = await signWindowsArtifacts({
    artifactPaths: [installer, '/fixture/Mineradio-1.0.0-Setup.exe.blockmap'],
  }, {
    platform: 'win32',
    sign(filePath) { calls.push(filePath); },
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, [installer]);
});

test('Windows artifact hook rejects ambiguous installer output', async function() {
  await assert.rejects(signWindowsArtifacts({
    artifactPaths: [
      '/fixture/Mineradio-1.0.0-Setup.exe',
      '/fixture/Mineradio-2.0.0-Setup.exe',
    ],
  }, {
    platform: 'win32',
    sign() {},
  }), /at most one Windows NSIS installer, found 2/);
});
