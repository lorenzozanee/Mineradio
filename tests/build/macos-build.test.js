'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createMacConfiguration } = require('../../build/macos/configuration');
const {
  patchMacosHelperUsageDescriptions,
  USAGE_DESCRIPTIONS,
} = require('../../build/macos/after-pack');
const {
  notarizeMacApp,
  readNotarizationCredentials
} = require('../../build/macos/notarize');
const {
  assertArm64Executable,
  findAbsoluteUserPaths,
  findPrivatePaths
} = require('../../build/macos/validate-dmg');

const MACOS_RESOURCES = path.resolve(__dirname, '../../build/macos');
const ICNS_PATH = path.join(MACOS_RESOURCES, 'icon.icns');
const DMG_BG_PATH = path.join(MACOS_RESOURCES, 'dmg-background.png');

test('macOS production configuration is arm64-only and fails closed without signing', function() {
  const config = createMacConfiguration({});

  assert.deepEqual(config.mac.target, [{ target: 'dmg', arch: ['arm64'] }]);
  assert.equal(config.mac.forceCodeSigning, true);
  assert.equal(Object.hasOwn(config.mac, 'identity'), false);
  assert.equal(config.mac.hardenedRuntime, true);
  assert.equal(config.mac.notarize, false, 'custom afterSign hook owns notarization');
  assert.deepEqual(config.mac.extendInfo, {
    NSCameraUsageDescription: 'Mineradio 仅在你开启手势控制时使用摄像头。',
    NSCameraUseContinuityCameraDeviceType: true,
    NSMicrophoneUsageDescription: 'Mineradio 仅在你开启音频监测功能时使用麦克风。',
  });
  assert.equal(config.afterSign, 'build/macos/notarize.js');
  assert.equal(config.afterPack, 'build/macos/after-pack.js');
  assert.equal(config.win, undefined);
  assert.equal(config.nsis, undefined);
  assert.equal(config.publish, null);
  assert.ok(config.files.includes('!build/**/*'));
  assert.ok(config.files.includes('!desktop/platform/windows/**/*'));
  assert.ok(config.files.includes('!desktop/full-desktop-mode-runtime.js'));
  assert.ok(config.files.includes('!desktop/wallpaper-engine-*.js'));
});

test('afterPack adds camera and microphone usage descriptions to every macOS helper', function() {
  const entries = [
    { name: 'Mineradio Helper.app', isDirectory: function() { return true; } },
    { name: 'Mineradio Helper (Renderer).app', isDirectory: function() { return true; } },
    { name: 'Unrelated.app', isDirectory: function() { return true; } },
  ];
  const calls = [];
  const plists = patchMacosHelperUsageDescriptions({
    electronPlatformName: 'darwin',
    appOutDir: '/fixture/output',
    packager: { appInfo: { productFilename: 'Mineradio' } },
  }, {
    readdirSync: function() { return entries; },
    run: function(command, args) { calls.push([command, args]); },
  });
  assert.equal(plists.length, 2);
  assert.equal(calls.length, 2 * Object.keys(USAGE_DESCRIPTIONS).length);
  assert.ok(calls.every(function(call) { return call[0] === 'plutil' && call[1][0] === '-replace'; }));
  assert.ok(calls.some(function(call) { return call[1].includes('NSCameraUseContinuityCameraDeviceType'); }));
  assert.throws(function() {
    patchMacosHelperUsageDescriptions({
      electronPlatformName: 'darwin',
      appOutDir: '/fixture/output',
      packager: { appInfo: { productFilename: 'Mineradio' } },
    }, { readdirSync: function() { return []; } });
  }, /No macOS Electron helper/);
});

test('unsigned macOS output requires the explicit local opt-out', function() {
  const config = createMacConfiguration({ MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD: '1' });
  assert.equal(config.mac.forceCodeSigning, false);
  assert.equal(config.mac.identity, null);

  const nearMiss = createMacConfiguration({ MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD: 'true' });
  assert.equal(nearMiss.mac.forceCodeSigning, true);
  assert.equal(Object.hasOwn(nearMiss.mac, 'identity'), false);

  assert.throws(function() {
    createMacConfiguration({ CI: 'true', MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD: '1' });
  }, /limited to explicit local validation/);
});

test('release entitlements contain only the Electron JIT exception', function() {
  const source = fs.readFileSync(path.join(__dirname, '../../build/macos/entitlements.plist'), 'utf8');
  const entitlementKeys = Array.from(source.matchAll(/<key>([^<]+)<\/key>/g), function(match) { return match[1]; });
  assert.deepEqual(entitlementKeys, ['com.apple.security.cs.allow-jit']);
  assert.doesNotMatch(source, /get-task-allow|disable-library-validation|app-sandbox|allow-unsigned-executable-memory/);
});

test('notarization credentials are complete and reference an existing key', function() {
  assert.throws(function() {
    readNotarizationCredentials({ APPLE_API_KEY: '/tmp/key.p8' }, function() { return true; });
  }, /APPLE_API_KEY_ID, APPLE_API_ISSUER/);

  assert.throws(function() {
    readNotarizationCredentials({
      APPLE_API_KEY: '/tmp/missing.p8',
      APPLE_API_KEY_ID: 'KEY1234567',
      APPLE_API_ISSUER: 'issuer'
    }, function() { return false; });
  }, /does not point to a readable private key/);
});

test('afterSign notarizes the signed app and never sends unrelated environment values', async function() {
  let invocation;
  const context = {
    electronPlatformName: 'darwin',
    appOutDir: '/tmp/mineradio-output',
    packager: { appInfo: { productFilename: 'Mineradio' } }
  };
  await notarizeMacApp(context, {
    env: {
      APPLE_API_KEY: '/tmp/AuthKey.p8',
      APPLE_API_KEY_ID: 'KEY1234567',
      APPLE_API_ISSUER: 'issuer',
      UNRELATED_SECRET: 'must-not-be-forwarded'
    },
    fileExists: function() { return true; },
    logger: { log: function() {}, warn: function() {} },
    notarize: async function(options) { invocation = options; }
  });

  assert.deepEqual(invocation, {
    appPath: path.join(context.appOutDir, 'Mineradio.app'),
    appleApiKey: path.resolve('/tmp/AuthKey.p8'),
    appleApiKeyId: 'KEY1234567',
    appleApiIssuer: 'issuer'
  });
});

test('afterSign skips only the exact explicit unsigned-local value', async function() {
  let called = false;
  const context = {
    electronPlatformName: 'darwin',
    appOutDir: '/tmp/output',
    packager: { appInfo: { productFilename: 'Mineradio' } }
  };
  await notarizeMacApp(context, {
    env: { MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD: '1' },
    logger: { log: function() {}, warn: function() {} },
    notarize: async function() { called = true; }
  });
  assert.equal(called, false);

  await assert.rejects(notarizeMacApp(context, {
    env: { CI: 'true', MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD: '1' },
    logger: { log: function() {}, warn: function() {} },
    notarize: async function() { called = true; }
  }), /not permitted in CI/);

  await assert.rejects(notarizeMacApp(context, {
    env: { MINERADIO_ALLOW_UNSIGNED_MACOS_BUILD: 'true' },
    fileExists: function(filePath) { return filePath.endsWith('.app'); },
    logger: { log: function() {}, warn: function() {} },
    notarize: async function() { called = true; }
  }), /credentials are incomplete/);
});

test('artifact helpers reject non-arm64 binaries and private runtime files', function() {
  assert.doesNotThrow(function() {
    assertArm64Executable('/tmp/Mineradio', function() { return 'arm64\n'; });
  });
  assert.throws(function() {
    assertArm64Executable('/tmp/Mineradio', function() { return 'x86_64 arm64\n'; });
  }, /arm64-only/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-artifact-test-'));
  try {
    fs.writeFileSync(path.join(root, '.cookie'), 'synthetic-test-value');
    fs.writeFileSync(path.join(root, 'safe.json'), '{}');
    assert.deepEqual(findPrivatePaths(root).map(function(filePath) { return path.basename(filePath); }), ['.cookie']);
    assert.deepEqual(findAbsoluteUserPaths(root), []);
    fs.writeFileSync(path.join(root, 'leaked-path.txt'), '/Users/example/Music/private.flac');
    assert.deepEqual(findAbsoluteUserPaths(root).map(function(filePath) { return path.basename(filePath); }), ['leaked-path.txt']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('macOS build resources include a valid .icns icon and DMG background', function() {
  assert.ok(fs.existsSync(ICNS_PATH), 'icon.icns must exist');
  const icnsContent = fs.readFileSync(ICNS_PATH);
  assert.ok(icnsContent.length > 0, 'icon.icns must not be empty');
  assert.ok(fs.existsSync(DMG_BG_PATH), 'dmg-background.png must exist');
  const bgContent = fs.readFileSync(DMG_BG_PATH);
  assert.ok(bgContent.length > 0, 'dmg-background.png must not be empty');
});

test('macOS build config references the .icns icon and DMG background', function() {
  const config = createMacConfiguration({});
  assert.equal(config.mac.icon, 'build/macos/icon.icns');
  assert.equal(config.dmg.background, 'build/macos/dmg-background.png');
  assert.equal(config.dmg.window.width, 660);
  assert.equal(config.dmg.window.height, 400);
});
