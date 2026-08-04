'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readWorkflow(name) {
  return fs.readFileSync(path.join(__dirname, '../../.github/workflows', name), 'utf8');
}

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r+\n/g, '\n');
}

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
}

test('untrusted pull requests run secret-free contracts on both target operating systems', function() {
  const workflow = normalizeLineEndings(readWorkflow('cross-platform-ci.yml'));
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  const protectedBranchFilter = /branches:\n\s+- main\n\s+- macos\n\s+- codex\/macos/;
  assert.match(workflow, protectedBranchFilter);
  assert.match(normalizeLineEndings('branches:\r\r\n  - main\r\r\n  - macos\r\r\n  - codex/macos'), protectedBranchFilter);
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

test('native validation emits a manifest and publisher only reuses approved artifacts', function() {
  const validation = normalizeLineEndings(readWorkflow('native-package-validation.yml'));
  const publisher = normalizeLineEndings(readWorkflow('release-publisher.yml'));
  assert.match(validation, /needs: \[windows-x64, macos-arm64\]/);
  assert.match(validation, /Check out candidate source for version metadata/);
  assert.match(validation, /Mineradio-native-manifest-\$\{\{ github\.sha \}\}/);
  assert.match(validation, /SHA256SUMS/);
  assert.match(publisher, /^\s*workflow_dispatch:\s*$/m);
  assert.match(publisher, /environment: release-publisher/);
  assert.match(publisher, /validation_run_id/);
  assert.match(publisher, /qa_attestation/);
  assert.match(publisher, /security_attestation/);
  assert.match(publisher, /actions\/download-artifact@[a-f0-9]{40}/);
  assert.match(publisher, /run-id: \$\{\{ inputs\.validation_run_id \}\}/);
  assert.match(publisher, /run_status.*completed/);
  assert.match(publisher, /run_conclusion.*success/);
  assert.match(publisher, /test -f "release-input\/artifacts\/\$windows_name"/);
  assert.match(publisher, /sha256sum -c \.\.\/SHA256SUMS/);
  assert.match(publisher, /git tag -a/);
  assert.match(publisher, /gh release create .*--draft/);
  assert.doesNotMatch(publisher, /npm (?:ci|install|run build|run test)/);
  assert.doesNotMatch(publisher, /electron-builder/);
});

test('every third-party action is pinned to a full commit SHA', function() {
  for (const name of ['cross-platform-ci.yml', 'native-package-validation.yml', 'release-publisher.yml']) {
    const workflow = readWorkflow(name);
    const actions = Array.from(workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm), function(match) { return match[1]; });
    assert.ok(actions.length > 0);
    for (const action of actions) assert.match(action, /^[^@]+@[a-f0-9]{40}$/);
  }
});
