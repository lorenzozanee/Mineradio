'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GLOBAL_SHORTCUT_MAX_BINDINGS,
  GLOBAL_SHORTCUT_MAX_ACCELERATOR_LENGTH,
  normalizeMacosAccelerator,
  normalizeMacosShortcutBinding,
  createMacosGlobalShortcutService,
} = require('../../../desktop/platform/macos/shortcuts');

test('macOS shortcuts normalize shared Ctrl and Meta input for Electron', () => {
  assert.deepEqual(normalizeMacosAccelerator('Ctrl+Alt+KeyL'), {
    ok: true,
    accelerator: 'CommandOrControl+Alt+L',
  });
  assert.deepEqual(normalizeMacosAccelerator('Meta+Shift+ArrowRight'), {
    ok: true,
    accelerator: 'Command+Shift+Right',
  });
  assert.deepEqual(normalizeMacosAccelerator('Control+Option+Digit4'), {
    ok: true,
    accelerator: 'CommandOrControl+Alt+4',
  });
});

test('macOS shortcuts accept only one supported modifier set and key', () => {
  for (const accelerator of [
    '',
    'KeyP',
    'Ctrl',
    'Ctrl+Ctrl+KeyP',
    'Ctrl+Meta+KeyP',
    'Ctrl+Hyper+KeyP',
    'Ctrl+KeyP+Alt',
    'Ctrl+Numpad1',
    `Ctrl+${'A'.repeat(GLOBAL_SHORTCUT_MAX_ACCELERATOR_LENGTH)}`,
  ]) {
    assert.equal(normalizeMacosAccelerator(accelerator).ok, false, accelerator);
  }
  assert.deepEqual(normalizeMacosAccelerator('Ctrl+Alt+F24'), {
    ok: true,
    accelerator: 'CommandOrControl+Alt+F24',
  });
});

test('macOS shortcut bindings reject unrecognized and full desktop actions', () => {
  assert.deepEqual(normalizeMacosShortcutBinding({
    action: 'openSystemShell',
    accelerator: 'Ctrl+Alt+KeyP',
  }), {
    ok: false,
    error: 'INVALID_SHORTCUT_ACTION',
  });
  assert.deepEqual(normalizeMacosShortcutBinding({
    action: 'toggleDesktopInteraction',
    accelerator: 'Ctrl+Shift+KeyM',
  }), {
    ok: false,
    unsupported: true,
    capability: 'fullDesktopMode',
    error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
  });
});

test('macOS shortcut service registers canonical shortcuts once and dispatches their action', () => {
  const calls = [];
  const handlers = new Map();
  const actions = [];
  const service = createMacosGlobalShortcutService({
    globalShortcut: {
      register(accelerator, handler) {
        calls.push(['register', accelerator]);
        handlers.set(accelerator, handler);
        return true;
      },
      unregister(accelerator) {
        calls.push(['unregister', accelerator]);
        handlers.delete(accelerator);
      },
    },
    onAction(action) {
      actions.push(action);
    },
  });

  const result = service.configure([
    { action: 'togglePlay', accelerator: 'Ctrl+Alt+Space' },
    { action: 'togglePlay', accelerator: 'Control+Alt+Space' },
    { action: 'nextTrack', accelerator: 'Meta+ArrowRight' },
  ]);

  assert.deepEqual(result, {
    ok: true,
    results: [
      { action: 'togglePlay', accelerator: 'CommandOrControl+Alt+Space', ok: true },
      { action: 'togglePlay', accelerator: 'CommandOrControl+Alt+Space', ok: false, error: 'GLOBAL_SHORTCUT_DUPLICATE' },
      { action: 'nextTrack', accelerator: 'Command+Right', ok: true },
    ],
  });
  assert.deepEqual(calls, [
    ['register', 'CommandOrControl+Alt+Space'],
    ['register', 'Command+Right'],
  ]);
  handlers.get('Command+Right')();
  assert.deepEqual(actions, ['nextTrack']);
});

test('macOS shortcut service bounds malformed and oversized batches before side effects', () => {
  const calls = [];
  const service = createMacosGlobalShortcutService({
    globalShortcut: {
      register() { calls.push('register'); return true; },
      unregister() { calls.push('unregister'); },
    },
  });

  assert.deepEqual(service.configure('not-an-array'), {
    ok: false,
    error: 'INVALID_GLOBAL_SHORTCUT_BINDINGS',
    results: [],
  });
  assert.deepEqual(service.configure(Array.from({ length: GLOBAL_SHORTCUT_MAX_BINDINGS + 1 }, () => ({
    action: 'togglePlay',
    accelerator: 'Ctrl+Alt+Space',
  }))), {
    ok: false,
    error: 'GLOBAL_SHORTCUT_LIMIT_EXCEEDED',
    results: [],
  });
  assert.deepEqual(service.configure([{ action: 'togglePlay', accelerator: 'KeyP' }]), {
    ok: false,
    error: 'INVALID_GLOBAL_SHORTCUT_BINDINGS',
    results: [{ ok: false, error: 'GLOBAL_SHORTCUT_MODIFIER_REQUIRED' }],
  });
  assert.deepEqual(calls, []);
});

test('macOS shortcut service reports missing or rejected registration without a false success', () => {
  const missing = createMacosGlobalShortcutService();
  assert.deepEqual(missing.configure([{ action: 'togglePlay', accelerator: 'Ctrl+Alt+Space' }]), {
    ok: false,
    error: 'GLOBAL_SHORTCUT_UNAVAILABLE',
    results: [],
  });
  assert.deepEqual(missing.configure([{ action: 'toggleDesktopInteraction', accelerator: 'Ctrl+Shift+KeyM' }]), {
    ok: false,
    results: [{
      action: 'toggleDesktopInteraction',
      accelerator: 'CommandOrControl+Shift+M',
      ok: false,
      unsupported: true,
      capability: 'fullDesktopMode',
      error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
    }],
  });

  const service = createMacosGlobalShortcutService({
    globalShortcut: {
      register() { return false; },
      unregister() { throw new Error('should not be called'); },
    },
  });
  assert.deepEqual(service.configure([{ action: 'togglePlay', accelerator: 'Ctrl+Alt+Space' }]), {
    ok: false,
    results: [{
      action: 'togglePlay',
      accelerator: 'CommandOrControl+Alt+Space',
      ok: false,
      error: 'GLOBAL_SHORTCUT_CONFLICT',
    }],
  });
});

test('macOS shortcut service skips unsupported desktop mode registration and cleanup is idempotent', () => {
  const calls = [];
  const service = createMacosGlobalShortcutService({
    globalShortcut: {
      register(accelerator) { calls.push(['register', accelerator]); return true; },
      unregister(accelerator) { calls.push(['unregister', accelerator]); },
    },
  });

  assert.deepEqual(service.configure([
    { action: 'toggleDesktopInteraction', accelerator: 'Ctrl+Shift+KeyM' },
  ]), {
    ok: false,
    results: [{
      action: 'toggleDesktopInteraction',
      accelerator: 'CommandOrControl+Shift+M',
      ok: false,
      unsupported: true,
      capability: 'fullDesktopMode',
      error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
    }],
  });
  assert.deepEqual(calls, []);

  service.configure([{ action: 'togglePlay', accelerator: 'Ctrl+Alt+Space' }]);
  assert.deepEqual(service.cleanup(), { ok: true });
  assert.deepEqual(service.cleanup(), { ok: true });
  assert.deepEqual(calls, [
    ['register', 'CommandOrControl+Alt+Space'],
    ['unregister', 'CommandOrControl+Alt+Space'],
  ]);
});
