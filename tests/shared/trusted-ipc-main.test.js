'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createTrustedIpcMain,
  validateIpcArguments,
} = require('../../desktop/shared/trusted-ipc-main');

function harness(authorize) {
  const handles = new Map();
  const listeners = new Map();
  const ipcMain = {
    handle(channel, handler) { handles.set(channel, handler); },
    on(channel, listener) { listeners.set(channel, listener); },
  };
  return {
    handles,
    listeners,
    trusted: createTrustedIpcMain({ ipcMain, authorize }),
  };
}

test('trusted IPC rejects forged senders before invoking a privileged handler', async function() {
  const calls = [];
  const fixture = harness(function(event, channel) {
    calls.push(['authorize', event.id, channel]);
    return event.id === 'main';
  });
  fixture.trusted.handle('fixture-write', function(_event, payload) {
    calls.push(['handler', payload]);
    return { ok: true };
  });
  assert.deepEqual(await fixture.handles.get('fixture-write')({ id: 'forged' }, { value: 1 }), {
    ok: false,
    error: 'IPC_UNTRUSTED_SENDER',
    channel: 'fixture-write',
  });
  assert.deepEqual(calls, [['authorize', 'forged', 'fixture-write']]);
});

test('trusted IPC validates bounded structured arguments before side effects', async function() {
  let invoked = 0;
  const fixture = harness(function() { return true; });
  fixture.trusted.handle('fixture-write', function() { invoked += 1; return { ok: true }; });
  const cyclic = {};
  cyclic.self = cyclic;
  for (const args of [
    [Number.NaN],
    [new Uint8Array(2)],
    [cyclic],
    ['x'.repeat(17 * 1024 * 1024)],
    [1, 2, 3, 4, 5],
  ]) {
    const result = await fixture.handles.get('fixture-write')({ id: 'main' }, ...args);
    assert.equal(result.error, 'IPC_PAYLOAD_INVALID');
  }
  assert.equal(invoked, 0);
  assert.deepEqual(await fixture.handles.get('fixture-write')({ id: 'main' }, { nested: ['safe', 1, true] }), { ok: true });
  assert.equal(invoked, 1);
});

test('trusted synchronous listeners return a stable denial and preserve legitimate return values', function() {
  const fixture = harness(function(event) { return event.id === 'main'; });
  fixture.trusted.on('fixture-sync', function(event, value) { event.returnValue = { ok: true, value }; });
  const denied = { id: 'overlay' };
  fixture.listeners.get('fixture-sync')(denied, 'value');
  assert.equal(denied.returnValue.error, 'IPC_UNTRUSTED_SENDER');
  const accepted = { id: 'main' };
  fixture.listeners.get('fixture-sync')(accepted, 'value');
  assert.deepEqual(accepted.returnValue, { ok: true, value: 'value' });
});

test('argument validation rejects getters, custom prototypes, excess depth, and excess entries', function() {
  const getter = {};
  Object.defineProperty(getter, 'value', { enumerable: true, get() { return 'unsafe'; } });
  const custom = Object.create({ inherited: true });
  custom.value = true;
  assert.equal(validateIpcArguments([getter]), false);
  assert.equal(validateIpcArguments([custom]), false);
  assert.equal(validateIpcArguments([[[[[[[[[true]]]]]]]]]), false);
  assert.equal(validateIpcArguments([{ a: 1, b: 2 }], { maxEntries: 1 }), false);
});
