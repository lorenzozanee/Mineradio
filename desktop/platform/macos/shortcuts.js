'use strict';

const GLOBAL_SHORTCUT_MAX_BINDINGS = 32;
const GLOBAL_SHORTCUT_MAX_ACCELERATOR_LENGTH = 128;
const GLOBAL_SHORTCUT_MAX_ACTION_LENGTH = 64;

const DESKTOP_MODE_ACTION = 'toggleDesktopInteraction';
const SUPPORTED_ACTIONS = new Set([
  'togglePlay',
  'prevTrack',
  'nextTrack',
  'volumeUp',
  'volumeDown',
  'toggleFullscreen',
  DESKTOP_MODE_ACTION,
  'toggleDesktopLyrics',
]);

const MODIFIER_ALIASES = new Map([
  ['ctrl', 'CommandOrControl'],
  ['control', 'CommandOrControl'],
  ['commandorcontrol', 'CommandOrControl'],
  ['meta', 'Command'],
  ['super', 'Command'],
  ['command', 'Command'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
]);

const MODIFIER_ORDER = ['CommandOrControl', 'Command', 'Alt', 'Shift'];

const KEY_ALIASES = new Map([
  ['space', 'Space'],
  ['tab', 'Tab'],
  ['escape', 'Escape'],
  ['esc', 'Escape'],
  ['enter', 'Enter'],
  ['return', 'Enter'],
  ['backspace', 'Backspace'],
  ['delete', 'Delete'],
  ['insert', 'Insert'],
  ['home', 'Home'],
  ['end', 'End'],
  ['pageup', 'PageUp'],
  ['pagedown', 'PageDown'],
  ['arrowup', 'Up'],
  ['up', 'Up'],
  ['arrowdown', 'Down'],
  ['down', 'Down'],
  ['arrowleft', 'Left'],
  ['left', 'Left'],
  ['arrowright', 'Right'],
  ['right', 'Right'],
]);

function invalidShortcut(error) {
  return { ok: false, error };
}

function normalizeKey(value) {
  const lower = String(value || '').toLowerCase();
  if (KEY_ALIASES.has(lower)) return KEY_ALIASES.get(lower);
  const prefixedLetter = /^key([a-z])$/i.exec(value);
  if (prefixedLetter) return prefixedLetter[1].toUpperCase();
  if (/^[a-z]$/i.test(value)) return value.toUpperCase();
  const prefixedDigit = /^digit([0-9])$/i.exec(value);
  if (prefixedDigit) return prefixedDigit[1];
  if (/^[0-9]$/.test(value)) return value;
  const functionKey = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(value);
  if (functionKey) return `F${functionKey[1]}`;
  return '';
}

function normalizeMacosAccelerator(value) {
  if (typeof value !== 'string') return invalidShortcut('INVALID_GLOBAL_SHORTCUT_ACCELERATOR');
  const input = value.trim();
  if (!input) return invalidShortcut('INVALID_GLOBAL_SHORTCUT_ACCELERATOR');
  if (input.length > GLOBAL_SHORTCUT_MAX_ACCELERATOR_LENGTH) {
    return invalidShortcut('GLOBAL_SHORTCUT_ACCELERATOR_TOO_LONG');
  }

  const parts = input.split('+').map(part => part.trim());
  if (parts.some(part => !part)) return invalidShortcut('INVALID_GLOBAL_SHORTCUT_ACCELERATOR');

  const key = normalizeKey(parts[parts.length - 1]);
  if (!key) return invalidShortcut('INVALID_GLOBAL_SHORTCUT_KEY');

  const modifiers = new Set();
  for (const part of parts.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES.get(part.toLowerCase());
    if (!modifier) return invalidShortcut('INVALID_GLOBAL_SHORTCUT_MODIFIER');
    if (modifiers.has(modifier)) return invalidShortcut('GLOBAL_SHORTCUT_DUPLICATE_MODIFIER');
    modifiers.add(modifier);
  }
  if (!modifiers.size) return invalidShortcut('GLOBAL_SHORTCUT_MODIFIER_REQUIRED');
  if (modifiers.has('CommandOrControl') && modifiers.has('Command')) {
    return invalidShortcut('GLOBAL_SHORTCUT_DUPLICATE_MODIFIER');
  }

  return {
    ok: true,
    accelerator: MODIFIER_ORDER.filter(modifier => modifiers.has(modifier)).concat(key).join('+'),
  };
}

function normalizeMacosShortcutBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return invalidShortcut('INVALID_SHORTCUT_BINDING');
  }
  if (typeof binding.action !== 'string') return invalidShortcut('INVALID_SHORTCUT_ACTION');
  const action = binding.action.trim();
  if (!action || action.length > GLOBAL_SHORTCUT_MAX_ACTION_LENGTH || !SUPPORTED_ACTIONS.has(action)) {
    return invalidShortcut('INVALID_SHORTCUT_ACTION');
  }
  if (action === DESKTOP_MODE_ACTION) {
    return {
      ok: false,
      unsupported: true,
      capability: 'fullDesktopMode',
      error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
    };
  }

  const accelerator = normalizeMacosAccelerator(binding.accelerator);
  if (!accelerator.ok) return accelerator;
  return { ok: true, action, accelerator: accelerator.accelerator };
}

function hasGlobalShortcutApi(globalShortcut) {
  return !!(globalShortcut
    && typeof globalShortcut.register === 'function'
    && typeof globalShortcut.unregister === 'function');
}

function createMacosGlobalShortcutService(options = {}) {
  const globalShortcut = options.globalShortcut;
  const onAction = typeof options.onAction === 'function' ? options.onAction : () => {};
  const registered = new Map();

  function cleanup() {
    for (const accelerator of registered.keys()) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (_) {
        // Electron shutdown can invalidate the native shortcut bridge first.
      }
    }
    registered.clear();
    return { ok: true };
  }

  function configure(bindings) {
    if (!Array.isArray(bindings)) {
      return { ok: false, error: 'INVALID_GLOBAL_SHORTCUT_BINDINGS', results: [] };
    }
    if (bindings.length > GLOBAL_SHORTCUT_MAX_BINDINGS) {
      return { ok: false, error: 'GLOBAL_SHORTCUT_LIMIT_EXCEEDED', results: [] };
    }
    const normalized = bindings.map((binding) => {
      const result = normalizeMacosShortcutBinding(binding);
      if (result.unsupported !== true) return result;
      const accelerator = normalizeMacosAccelerator(binding && binding.accelerator);
      if (!accelerator.ok) return accelerator;
      return { ...result, action: DESKTOP_MODE_ACTION, accelerator: accelerator.accelerator };
    });
    const invalid = normalized.filter(result => !result.ok && result.unsupported !== true);
    if (invalid.length) {
      return { ok: false, error: 'INVALID_GLOBAL_SHORTCUT_BINDINGS', results: normalized };
    }
    if (!hasGlobalShortcutApi(globalShortcut)) {
      if (normalized.every(result => result.unsupported === true)) {
        return {
          ok: false,
          results: normalized.map(result => ({
            action: result.action,
            accelerator: result.accelerator,
            ok: false,
            unsupported: true,
            capability: result.capability,
            error: result.error,
          })),
        };
      }
      return { ok: false, error: 'GLOBAL_SHORTCUT_UNAVAILABLE', results: [] };
    }

    cleanup();
    const seen = new Set();
    const results = normalized.map((binding) => {
      if (binding.unsupported === true) {
        return {
          action: binding.action,
          accelerator: binding.accelerator,
          ok: false,
          unsupported: true,
          capability: binding.capability,
          error: binding.error,
        };
      }
      if (seen.has(binding.accelerator)) {
        return {
          action: binding.action,
          accelerator: binding.accelerator,
          ok: false,
          error: 'GLOBAL_SHORTCUT_DUPLICATE',
        };
      }
      seen.add(binding.accelerator);

      let registeredSuccessfully = false;
      try {
        registeredSuccessfully = globalShortcut.register(binding.accelerator, () => {
          try {
            onAction(binding.action);
          } catch (_) {
            // A renderer callback cannot compromise the native shortcut bridge.
          }
        }) === true;
      } catch (_) {
        registeredSuccessfully = false;
      }
      if (!registeredSuccessfully) {
        return {
          action: binding.action,
          accelerator: binding.accelerator,
          ok: false,
          error: 'GLOBAL_SHORTCUT_CONFLICT',
        };
      }
      registered.set(binding.accelerator, binding.action);
      return { action: binding.action, accelerator: binding.accelerator, ok: true };
    });

    return { ok: results.some(result => result.ok), results };
  }

  return Object.freeze({ configure, cleanup });
}

module.exports = {
  DESKTOP_MODE_ACTION,
  GLOBAL_SHORTCUT_MAX_BINDINGS,
  GLOBAL_SHORTCUT_MAX_ACCELERATOR_LENGTH,
  GLOBAL_SHORTCUT_MAX_ACTION_LENGTH,
  normalizeMacosAccelerator,
  normalizeMacosShortcutBinding,
  createMacosGlobalShortcutService,
};
