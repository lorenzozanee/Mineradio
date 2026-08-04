'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '../..');
const mainText = fs.readFileSync(path.join(appRoot, 'desktop/main.js'), 'utf8');
const preloadText = fs.readFileSync(path.join(appRoot, 'desktop/preload.js'), 'utf8');
const htmlText = fs.readFileSync(path.join(appRoot, 'public/index.html'), 'utf8');
const preferencesText = fs.readFileSync(path.join(appRoot, 'public/js/modules/00-state/02-preferences-ui-modes.js'), 'utf8');

test('capability discovery keeps IPC behind the trusted main document', () => {
  assert.match(mainText, /ipcMain\.handle\('mineradio-platform-capabilities', \(event\) => \{/);
  assert.match(mainText, /if \(!isTrustedMainWindowIpc\(event\)\) return \{ ok: false, error: 'PLATFORM_UNTRUSTED_SENDER' \}/);
  assert.match(mainText, /return platform\.snapshot\(\)/);
  assert.match(preloadText, /getPlatformCapabilities: \(\) => ipcRenderer\.invoke\('mineradio-platform-capabilities'\)/);
  assert.doesNotMatch(preloadText, /\bipcRenderer\s*:\s*ipcRenderer\b/);
  assert.doesNotMatch(preloadText, /exposeInMainWorld\(\s*['"]desktopWindow['"]\s*,\s*ipcRenderer\s*\)/);
});

test('desktop-mode IPC routes through the selected platform service', () => {
  assert.match(mainText, /platform\.desktopMode\.enable\(payload \|\| \{\}\)/);
  assert.match(mainText, /platform\.desktopMode\.disable\('renderer-disabled'\)/);
  assert.match(mainText, /platform\.desktopMode\.getStatus\('renderer-update'\)/);
  assert.match(mainText, /platform\.desktopMode\.getStatus\('renderer-query'\)/);
});

test('tray close behavior is capability-gated', () => {
  assert.match(mainText, /value === 'tray' && platform\.supports\('tray'\) \? 'tray' : 'exit'/);
  assert.match(htmlText, /data-close-behavior="tray" data-platform-capability="tray" hidden/);
  assert.match(preferencesText, /applyCloseBehaviorPreference\(result && result\.behavior\)/);
});
