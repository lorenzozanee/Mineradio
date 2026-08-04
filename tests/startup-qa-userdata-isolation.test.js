'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const mainText = fs.readFileSync(path.join(appRoot, 'desktop', 'main.js'), 'utf8');
const quickCheckText = fs.readFileSync(path.join(appRoot, 'scripts', 'quick-check.js'), 'utf8');
const startupQaPathsText = fs.readFileSync(path.join(appRoot, 'desktop', 'shared', 'startup-qa-paths.js'), 'utf8');
const { resolveStartupQaUserDataPath } = require('../desktop/shared/startup-qa-paths');

test('startup QA isolates its disposable userData away from the real profile', () => {
  assert.match(mainText, /resolveStartupQaUserDataPath\(\)/);
  assert.match(startupQaPathsText, /MINERADIO_STARTUP_QA_USER_DATA/);
  assert.match(startupQaPathsText, /MINERADIO_STARTUP_QA_ISOLATED/);
  assert.match(startupQaPathsText, /path\.isAbsolute\(value\)/);
  assert.match(mainText, /STARTUP_QA_USER_DATA_PATH \|\| path\.join\(app\.getPath\('appData'\), APP_NAME\)/);
  assert.match(quickCheckText, /path\.join\(process\.env\.TEMP \|\| appData, 'mineradio-startup-qa'\)/);
  assert.match(quickCheckText, /MINERADIO_STARTUP_QA_USER_DATA:\s*qaUserData/);
  assert.match(quickCheckText, /removeOwnedStartupQaDirectory\(qaUserData, qaUserDataParent, runtimeName\)/);
});

test('visible QA requires an explicit isolated profile and an absolute path', () => {
  const ownedPath = path.resolve('/synthetic/mineradio-visible-qa');
  assert.equal(resolveStartupQaUserDataPath({
    MINERADIO_STARTUP_QA_ISOLATED: '1',
    MINERADIO_STARTUP_QA_USER_DATA: ownedPath,
  }), ownedPath);
  assert.equal(resolveStartupQaUserDataPath({
    MINERADIO_STARTUP_QA_USER_DATA: ownedPath,
  }), '');
  assert.equal(resolveStartupQaUserDataPath({
    MINERADIO_STARTUP_QA_ISOLATED: '1',
    MINERADIO_STARTUP_QA_USER_DATA: '../real-profile',
  }), '');
});
