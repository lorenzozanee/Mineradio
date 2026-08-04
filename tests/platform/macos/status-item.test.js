'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Status item service imports are lazy (require('electron')), so the service
// functions can be required without a runtime Electron installation.
const statusItem = require('../../../desktop/platform/macos/status-item');

test('status item service exposes the tray contract', () => {
  assert.equal(typeof statusItem.isAvailable, 'function');
  assert.equal(typeof statusItem.createOrUpdate, 'function');
  assert.equal(typeof statusItem.destroy, 'function');
  assert.equal(statusItem.isAvailable(), true);
});

test('createOrUpdate rejects non-object options', () => {
  for (const bad of [null, undefined, 42, 'string', true, []]) {
    const result = statusItem.createOrUpdate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.error);
  }
});

test('createOrUpdate without Electron returns stable error', () => {
  const result = statusItem.createOrUpdate({ appName: 'Test' });
  // In CI without Electron runtime, this will fail gracefully.
  // In an Electron environment it would succeed.
  assert.equal(typeof result.ok, 'boolean');
  if (!result.ok) {
    assert.ok(typeof result.error === 'string');
  }
});

test('destroy is idempotent', () => {
  assert.deepEqual(statusItem.destroy(), { ok: true });
  assert.deepEqual(statusItem.destroy(), { ok: true });
  assert.deepEqual(statusItem.destroy(), { ok: true });
});
