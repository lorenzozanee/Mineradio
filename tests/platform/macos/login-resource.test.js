'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { getLoginWindowIcon } = require('../../../desktop/platform');

const ROOT = path.resolve(__dirname, '../../..');
const MACOS_ICNS = path.join(ROOT, 'build/macos/icon.icns');
const BUILD_ICO = path.join(ROOT, 'build/icon.ico');

test('getLoginWindowIcon returns null on macOS darwin', function () {
  assert.equal(getLoginWindowIcon(), null, 'macOS login windows must not use a Windows .ico path');
});

test('loginWindowIcon in main.js is derived from getLoginWindowIcon()', function () {
  const source = fs.readFileSync(path.join(ROOT, 'desktop/main.js'), 'utf8');
  assert.match(source, /const loginWindowIcon = getLoginWindowIcon\(\)/,
    'main.js must define loginWindowIcon via getLoginWindowIcon()');
});

test('login window icon assignments use loginWindowIcon, not APP_ICON_ICO', function () {
  const source = fs.readFileSync(path.join(ROOT, 'desktop/main.js'), 'utf8');
  const iconAssignments = Array.from(source.matchAll(/^\s*icon:\s*(loginWindowIcon|APP_ICON_ICO)/gm));
  const loginWindowIconCount = iconAssignments.filter(function (m) { return m[1] === 'loginWindowIcon'; }).length;
  assert.ok(loginWindowIconCount >= 4,
    `expected >=4 login window icon assignments; found ${loginWindowIconCount}`);
});

test('macOS platform adapter does not reference build/icon.ico', function () {
  const source = fs.readFileSync(path.join(ROOT, 'desktop/platform/macos/index.js'), 'utf8');
  assert.doesNotMatch(source, /icon\.ico/, 'macOS platform adapter must not reference icon.ico');
});

test('macOS build config excludes Windows build/icon.ico and .bmp/NSIS files', function () {
  const config = require(path.join(ROOT, 'build/macos/configuration')).createMacConfiguration({});
  assert.ok(config.files.includes('!build/**/*'), 'macOS config must exclude build/**/*');
  const hasIco = config.files.some(function (e) { return typeof e === 'string' && e.endsWith('.ico'); });
  const hasBmp = config.files.some(function (e) { return typeof e === 'string' && e.endsWith('.bmp'); });
  const hasNsis = config.files.some(function (e) { return typeof e === 'string' && e.toLowerCase().includes('nsis'); });
  assert.equal(hasIco, false, 'macOS config must not include .ico files');
  assert.equal(hasBmp, false, 'macOS config must not include .bmp files');
  assert.equal(hasNsis, false, 'macOS config must not include NSIS files');
});

test('build/macos/icon.icns exists', function () {
  assert.ok(fs.existsSync(MACOS_ICNS), 'build/macos/icon.icns must exist');
  assert.ok(fs.statSync(MACOS_ICNS).size > 1000, 'icon.icns must be non-trivial');
});

test('build/icon.ico exists for Windows builds', function () {
  assert.ok(fs.existsSync(BUILD_ICO), 'build/icon.ico must exist for Windows');
});

test('platform/index.js exports getLoginWindowIcon', function () {
  const mod = require(path.join(ROOT, 'desktop/platform'));
  assert.equal(typeof mod.getLoginWindowIcon, 'function');
  assert.equal(typeof mod.createPlatform, 'function');
  assert.equal(typeof mod.loadNativeDesktopFeatures, 'function');
});
