'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readWorkflow(name) {
  return fs.readFileSync(path.join(__dirname, '../../.github/workflows', name), 'utf8');
}

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
}

test('untrusted pull requests run secret-free contracts on both target operating systems', function() {
  const workflow = readWorkflow('cross-platform-ci.yml');
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  const protectedBranchFilter = /branches:\r?\n\s+- main\r?\n\s+- macos\r?\n\s+- codex\/macos/;
  assert.match(workflow, protectedBranchFilter);
  assert.match(workflow.replace(/\n/g, '\r\n'), protectedBranchFilter);
  assert.match(workflow, /windows-2025/);
  assert.match(workflow, /macos-15/);
  assert.match(workflow, /npm run test:shared/);
  assert.match(workflow, /npm run test:platform/);
  assert.doesNotMatch(workflow, /pull_request_target|secrets\./);
  assert.match(workflow, /permissions:\n\s+contents: read/);
});

test('native packages only build through manual dispatch and protected signing environment', function() {
  const workflow = readWorkflow('native-package-validation.yml');
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/);
  assert.match(workflow, /runs-on: windows-2025/);
  assert.match(workflow, /runs-on: macos-15/);
  assert.match(workflow, /environment: release-signing/);
  assert.match(workflow, /APPLE_API_KEY_P8: \$\{\{ secrets\.APPLE_API_KEY_P8 \}\}/);
  assert.match(workflow, /node build\/macos\/validate-dmg\.js/);
  assert.match(workflow, /npm run build:mac/);
  assert.match(workflow, /npm run test:smoke:macos:package/);
  assert.match(readPackage().scripts['build:mac'], /--mac dmg --arm64 --publish never/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test('every third-party action is pinned to a full commit SHA', function() {
  for (const name of ['cross-platform-ci.yml', 'native-package-validation.yml']) {
    const workflow = readWorkflow(name);
    const actions = Array.from(workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm), function(match) { return match[1]; });
    assert.ok(actions.length > 0);
    for (const action of actions) assert.match(action, /^[^@]+@[a-f0-9]{40}$/);
  }
});
