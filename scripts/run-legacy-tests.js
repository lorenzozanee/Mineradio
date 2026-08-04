#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const LEGACY_TESTS = [
  'tests/kugou-vip-hardening.test.js',
  'tests/login-easter-egg-gate.test.js',
  'tests/login-easter-egg-ime-focus.test.js',
  'tests/platform-account-sync-guard.test.js',
  'tests/playback-audio-graph-recovery.test.js',
  'tests/playback-source-fallback-transaction.test.js',
  'tests/provider-entitlement-boundary.test.js',
  'tests/qishui-entitlement-cache.test.js',
  'tests/qishui-local-official-merge.test.js',
  'tests/qishui-provider-distribution.test.js',
  'tests/qq-vip-entitlement.test.js',
  'tests/spotify-api-resilience.test.js',
  'tests/startup-navigation-readiness.test.js',
];

const root = path.resolve(__dirname, '..');
let failed = 0;
let passed = 0;

for (const testFile of LEGACY_TESTS) {
  const result = spawnSync(process.execPath, [testFile], {
    cwd: root,
    stdio: 'inherit',
    timeout: 60000,
  });
  if (result.status !== 0) {
    console.error(`FAIL: ${testFile}`);
    failed++;
  } else {
    passed++;
  }
}

console.log(`\nLegacy tests: ${passed} passed, ${failed} failed, ${LEGACY_TESTS.length} total`);
if (failed > 0) {
  process.exit(1);
}
