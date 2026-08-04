'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PLATFORM_CHANNELS, registerPlatformIpc } = require('../../desktop/platform/ipc');

function createHarness(options = {}) {
  const handlers = new Map();
  const removed = [];
  const calls = [];
  const ipcMain = {
    handle(channel, handler) { handlers.set(channel, handler); },
    removeHandler(channel) { removed.push(channel); handlers.delete(channel); },
  };
  const supported = options.supported !== false;
  const platform = {
    desktopMode: {
      async enable(payload) { calls.push(['enable', payload]); return { ok: true, enabled: true }; },
      async disable(reason) { calls.push(['disable', reason]); return { ok: true, enabled: false }; },
      async getStatus(reason) { calls.push(['status', reason]); return { ok: true, enabled: false }; },
    },
    supports(capability) {
      assert.equal(capability, 'fullDesktopMode');
      return supported;
    },
    unsupported(capability, operation) {
      return {
        ok: false,
        unsupported: true,
        platform: 'darwin',
        capability,
        operation,
        error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
      };
    },
    snapshot() {
      calls.push(['snapshot']);
      return { ok: true, platform: 'win32', platformId: 'windows', capabilities: {} };
    },
  };
  const dispose = registerPlatformIpc({
    ipcMain,
    platform,
    isTrustedMainWindowIpc: event => event && event.trusted === true,
  });
  return { calls, dispose, handlers, platform, removed };
}

test('platform IPC registers only the bounded channel set', () => {
  const harness = createHarness();
  assert.deepEqual(Array.from(harness.handlers.keys()), Array.from(PLATFORM_CHANNELS));
});

test('capability discovery rejects untrusted senders without taking a snapshot', async () => {
  const harness = createHarness();
  const result = await harness.handlers.get('mineradio-platform-capabilities')({ trusted: false });
  assert.deepEqual(result, {
    ok: false,
    unsupported: false,
    operation: 'capabilities',
    error: 'PLATFORM_UNTRUSTED_SENDER',
  });
  assert.deepEqual(harness.calls, []);
});

test('capability discovery returns the adapter snapshot for the trusted main frame', async () => {
  const harness = createHarness();
  const result = await harness.handlers.get('mineradio-platform-capabilities')({ trusted: true });
  assert.equal(result.ok, true);
  assert.equal(result.platform, 'win32');
  assert.deepEqual(harness.calls, [['snapshot']]);
});

test('desktop-mode IPC returns unsupported before invoking macOS side effects', async () => {
  const harness = createHarness({ supported: false });
  const event = { trusted: true };
  const results = await Promise.all([
    harness.handlers.get('mineradio-wallpaper-set-enabled')(event, true, { reason: 'test' }),
    harness.handlers.get('mineradio-wallpaper-update')(event, { reason: 'test' }),
    harness.handlers.get('mineradio-wallpaper-get-status')(event),
  ]);
  assert.deepEqual(results.map(result => result.operation), ['enable', 'updateStatus', 'getStatus']);
  assert.ok(results.every(result => result.unsupported === true));
  assert.ok(results.every(result => result.error === 'PLATFORM_CAPABILITY_UNSUPPORTED'));
  assert.deepEqual(harness.calls, []);
});

test('desktop-mode IPC validates enabled and reason before side effects', async () => {
  const harness = createHarness();
  const handler = harness.handlers.get('mineradio-wallpaper-set-enabled');
  const wrongType = await handler({ trusted: true }, 'yes', {});
  const wrongPayload = await handler({ trusted: true }, true, []);
  const longReason = await handler({ trusted: true }, true, { reason: 'x'.repeat(129) });
  assert.equal(wrongType.error, 'PLATFORM_PAYLOAD_INVALID');
  assert.equal(wrongPayload.error, 'PLATFORM_PAYLOAD_INVALID');
  assert.equal(longReason.error, 'PLATFORM_PAYLOAD_INVALID');
  assert.deepEqual(harness.calls, []);
});

test('desktop-mode IPC normalizes payloads and delegates once', async () => {
  const harness = createHarness();
  const event = { trusted: true };
  assert.deepEqual(
    await harness.handlers.get('mineradio-wallpaper-set-enabled')(event, true, { reason: ' renderer ', ignored: 'value' }),
    { ok: true, enabled: true }
  );
  assert.deepEqual(
    await harness.handlers.get('mineradio-wallpaper-set-enabled')(event, false, null),
    { ok: true, enabled: false }
  );
  assert.deepEqual(
    await harness.handlers.get('mineradio-wallpaper-update')(event, { reason: ' refresh ' }),
    { ok: true, enabled: false }
  );
  assert.deepEqual(
    await harness.handlers.get('mineradio-wallpaper-get-status')(event),
    { ok: true, enabled: false }
  );
  assert.deepEqual(harness.calls, [
    ['enable', { reason: 'renderer' }],
    ['disable', 'renderer-disabled'],
    ['status', 'refresh'],
    ['status', 'renderer-query'],
  ]);
});

test('desktop-mode IPC bounds adapter exceptions to stable errors', async () => {
  const harness = createHarness();
  harness.platform.desktopMode.enable = async () => { throw new Error('private native detail'); };
  const result = await harness.handlers.get('mineradio-wallpaper-set-enabled')(
    { trusted: true },
    true,
    { reason: 'test' }
  );
  assert.deepEqual(result, {
    ok: false,
    unsupported: false,
    operation: 'enable',
    error: 'PLATFORM_OPERATION_FAILED',
  });
});

test('platform IPC cleanup is idempotent and removes every handler', () => {
  const harness = createHarness();
  harness.dispose();
  harness.dispose();
  assert.deepEqual(harness.removed, Array.from(PLATFORM_CHANNELS));
  assert.equal(harness.handlers.size, 0);
});
