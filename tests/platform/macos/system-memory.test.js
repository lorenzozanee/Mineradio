'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlatform } = require('../../../desktop/platform');

test('macOS system memory provides a bounded read-only snapshot', async () => {
  const memory = createPlatform({ nodePlatform: 'darwin' }).systemMemory;
  const snapshot = memory.getMemorySnapshot();
  assert.equal(snapshot.platform, 'darwin');
  assert.equal(Number.isFinite(snapshot.totalBytes), true);
  assert.equal(Number.isFinite(snapshot.freeBytes), true);
  assert.equal(snapshot.totalBytes >= snapshot.freeBytes, true);
  assert.equal(snapshot.usedPercent >= 0 && snapshot.usedPercent <= 100, true);
  assert.equal(Number.isFinite(snapshot.process.rssMB), true);
  const extended = await memory.getMemorySnapshotExtended();
  assert.equal(extended.platform, 'darwin');
  assert.equal(Number.isFinite(extended.totalBytes), true);
});

test('macOS system memory rejects Windows-only mutation explicitly', async () => {
  const memory = createPlatform({ nodePlatform: 'darwin' }).systemMemory;
  assert.equal(memory.SYSTEM_PURGE_AVAILABLE, false);
  assert.equal(memory.SYSTEM_PURGE_ENABLED, false);
  for (const result of [
    await memory.purgeSystemMemorySmart(29),
    await memory.trimAppWorkingSets([process.pid]),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.unsupported, true);
    assert.equal(result.error, 'PLATFORM_CAPABILITY_UNSUPPORTED');
  }
  assert.equal(await memory.probeProcessElevation(), false);
  assert.equal(await memory.isProcessElevated(), false);
});
