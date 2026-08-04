'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  importWindowsCertificate,
  normalizeThumbprint,
  readWindowsSigningConfig,
  removeWindowsCertificateStore,
  resolveSignTool,
  signWindowsFile,
} = require('../../build/windows/signing');
const { readWindowsTargetNames, signWindowsArtifacts } = require('../../build/windows/after-all-artifact-build');

const THUMBPRINT = '0123456789ABCDEF0123456789ABCDEF01234567';

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
    }, function() { return true; });
  }, /WINDOWS_CERTIFICATE_SHA1/);
  assert.throws(function() {
    readWindowsSigningConfig({
      WINDOWS_CERTIFICATE_PATH: '/fixture/cert.pfx',
      WINDOWS_CERTIFICATE_PASSWORD: 'secret',
      WINDOWS_CERTIFICATE_SHA1: THUMBPRINT,
      WINDOWS_TIMESTAMP_URL: 'http://timestamp.invalid',
    }, function() { return true; });
  }, /HTTPS/);
  assert.throws(function() {
    readWindowsSigningConfig({
      WINDOWS_CERTIFICATE_PATH: '/fixture/cert.pfx',
      WINDOWS_CERTIFICATE_PASSWORD: 'secret',
      WINDOWS_CERTIFICATE_SHA1: THUMBPRINT,
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

test('Windows signing uses the expected certificate, SHA-256 timestamping, and Authenticode verification', function() {
  const calls = [];
  const target = path.resolve('/fixture/Mineradio.exe');
  const result = signWindowsFile(target, {
    platform: 'win32',
    signTool: path.resolve('/fixture/signtool.exe'),
    existsSync() { return true; },
    env: {
      WINDOWS_CERTIFICATE_PATH: path.resolve('/fixture/cert.pfx'),
      WINDOWS_CERTIFICATE_PASSWORD: 'fixture-secret',
      WINDOWS_CERTIFICATE_SHA1: THUMBPRINT,
    },
    importCertificate() { return { signingThumbprint: THUMBPRINT, storeName: 'MineradioSigning-fixture' }; },
    removeCertificateStore(storeName) { calls.push({ removedStore: storeName }); },
    run(command, args) { calls.push({ command, args }); },
  });
  assert.equal(result.unsigned, false);
  assert.deepEqual(calls[0].args.slice(0, 7), ['sign', '/fd', 'SHA256', '/tr', 'https://timestamp.digicert.com/', '/td', 'SHA256']);
  assert.deepEqual(calls[0].args.slice(7, 11), ['/s', 'MineradioSigning-fixture', '/sha1', THUMBPRINT]);
  assert.doesNotMatch(calls[0].args.join(' '), /fixture-secret/);
  assert.equal(calls[0].args.includes('/p'), false);
  assert.equal(calls[0].args.includes('/f'), false);
  assert.deepEqual(calls[1].args, ['verify', '/pa', '/all', target]);
  assert.deepEqual(calls[2], { removedStore: 'MineradioSigning-fixture' });
});

test('PFX import passes its password only through the child environment', function() {
  const calls = [];
  const imported = importWindowsCertificate({
    certificatePath: 'C:\\fixture\\cert.pfx',
    password: 'fixture-secret',
  }, function(command, args, options) {
    calls.push({ command, args, options });
    return ` ${THUMBPRINT.toLowerCase()} `;
  });
  assert.equal(imported.signingThumbprint, THUMBPRINT);
  assert.match(imported.storeName, /^MineradioSigning-/);
  assert.doesNotMatch(calls[0].args.join(' '), /fixture-secret/);
  assert.equal(calls[0].options.env.MINERADIO_WINDOWS_PFX_PASSWORD, 'fixture-secret');
  assert.equal(calls[0].options.env.MINERADIO_WINDOWS_PFX_PATH, 'C:\\fixture\\cert.pfx');
});

test('temporary certificate-store cleanup rejects broad or unexpected targets', function() {
  assert.throws(function() {
    removeWindowsCertificateStore('My', function() {});
  }, /unexpected Windows certificate store/);
  const calls = [];
  removeWindowsCertificateStore('MineradioSigning-fixture', function(command, args, options) {
    calls.push({ command, args, options });
  });
  assert.equal(calls[0].options.env.MINERADIO_WINDOWS_CERT_STORE, 'MineradioSigning-fixture');
  assert.doesNotMatch(calls[0].args.join(' '), /MineradioSigning-fixture/);
});

test('certificate identity mismatch fails before signing and still removes the temporary store', function() {
  const calls = [];
  assert.throws(function() {
    signWindowsFile(path.resolve('/fixture/Mineradio.exe'), {
      platform: 'win32',
      signTool: path.resolve('/fixture/signtool.exe'),
      existsSync() { return true; },
      env: {
        WINDOWS_CERTIFICATE_PATH: path.resolve('/fixture/cert.pfx'),
        WINDOWS_CERTIFICATE_PASSWORD: 'fixture-secret',
        WINDOWS_CERTIFICATE_SHA1: THUMBPRINT,
      },
      importCertificate() {
        return { signingThumbprint: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', storeName: 'MineradioSigning-fixture' };
      },
      removeCertificateStore(storeName) { calls.push({ removedStore: storeName }); },
      run() { calls.push({ signed: true }); },
    });
  }, /does not match WINDOWS_CERTIFICATE_SHA1/);
  assert.deepEqual(calls, [{ removedStore: 'MineradioSigning-fixture' }]);
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

test('SignTool resolution requires an absolute Windows SDK result and expands the SDK root', function() {
  let script = '';
  assert.equal(resolveSignTool(function(command, args) {
    script = args[args.length - 1];
    return 'C:\\Windows Kits\\signtool.exe';
  }), 'C:\\Windows Kits\\signtool.exe');
  assert.match(script, /Join-Path \$\{env:ProgramFiles\(x86\)\}/);
  assert.doesNotMatch(script, /Join-Path '\$\{env:ProgramFiles/);
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
  const result = await signWindowsArtifacts({ artifactPaths: ['/fixture/installer.exe'] }, {
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
    targetNames: ['dir'],
    sign(filePath) { calls.push(filePath); },
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, []);
});

test('Windows artifact hook signs one NSIS installer regardless of its filename', async function() {
  const calls = [];
  const installer = path.resolve('/fixture/自定义安装产物.exe');
  const result = await signWindowsArtifacts({
    artifactPaths: [installer, '/fixture/自定义安装产物.exe.blockmap'],
  }, {
    platform: 'win32',
    targetNames: ['nsis'],
    sign(filePath) { calls.push(filePath); },
  });
  assert.deepEqual(result, []);
  assert.deepEqual(calls, [installer]);
});

test('Windows artifact hook rejects ambiguous installer output', async function() {
  await assert.rejects(signWindowsArtifacts({
    artifactPaths: ['/fixture/one.exe', '/fixture/two.exe'],
  }, {
    platform: 'win32',
    targetNames: ['nsis'],
    sign() {},
  }), /exactly one Windows NSIS installer, found 2/);
});

test('Windows NSIS target fails closed when no installer artifact is present', async function() {
  await assert.rejects(signWindowsArtifacts({ artifactPaths: ['/fixture/setup.blockmap'] }, {
    platform: 'win32',
    targetNames: ['nsis'],
    sign() {},
  }), /exactly one Windows NSIS installer, found 0/);
});

test('Windows target metadata is read from the electron-builder platform map', function() {
  const context = {
    platformToTargets: new Map([
      [{ nodeName: 'darwin' }, new Map([['dmg', {}]])],
      [{ nodeName: 'win32' }, new Map([['nsis', {}], ['dir', {}]])],
    ]),
  };
  assert.deepEqual(readWindowsTargetNames(context), ['nsis', 'dir']);
  assert.throws(function() { readWindowsTargetNames({}); }, /target metadata/);
});

test('certificate thumbprints normalize whitespace and reject unsafe values', function() {
  assert.equal(normalizeThumbprint('01 23456789abcdef0123456789abcdef01234567'), THUMBPRINT);
  assert.throws(function() { normalizeThumbprint('not-a-thumbprint'); }, /40-character/);
});
