'use strict';

const PLATFORM_CHANNELS = Object.freeze([
  'mineradio-platform-capabilities',
  'mineradio-wallpaper-set-enabled',
  'mineradio-wallpaper-update',
  'mineradio-wallpaper-get-status',
]);

function invalidPayload(operation) {
  return {
    ok: false,
    unsupported: false,
    operation,
    error: 'PLATFORM_PAYLOAD_INVALID',
  };
}

function untrustedSender(operation) {
  return {
    ok: false,
    unsupported: false,
    operation,
    error: 'PLATFORM_UNTRUSTED_SENDER',
  };
}

function failedOperation(operation) {
  return {
    ok: false,
    unsupported: false,
    operation,
    error: 'PLATFORM_OPERATION_FAILED',
  };
}

function normalizePayload(value, operation) {
  if (value == null) return { ok: true, value: {} };
  if (typeof value !== 'object' || Array.isArray(value)) return invalidPayload(operation);
  const reason = value.reason == null ? '' : String(value.reason).trim();
  if (reason.length > 128) return invalidPayload(operation);
  return { ok: true, value: reason ? { reason } : {} };
}

function registerPlatformIpc(options = {}) {
  const ipcMain = options.ipcMain;
  const platform = options.platform;
  const isTrustedMainWindowIpc = options.isTrustedMainWindowIpc;
  if (!ipcMain || typeof ipcMain.handle !== 'function' || typeof ipcMain.removeHandler !== 'function') {
    throw new Error('Platform IPC requires ipcMain.handle and ipcMain.removeHandler');
  }
  if (!platform || typeof platform.snapshot !== 'function' || !platform.desktopMode) {
    throw new Error('Platform IPC requires a platform contract');
  }
  if (typeof isTrustedMainWindowIpc !== 'function') {
    throw new Error('Platform IPC requires trusted sender validation');
  }

  function authorize(event, operation) {
    if (!isTrustedMainWindowIpc(event)) return untrustedSender(operation);
    if (!platform.supports('fullDesktopMode')) {
      return platform.unsupported('fullDesktopMode', operation);
    }
    return null;
  }

  ipcMain.handle('mineradio-platform-capabilities', (event) => {
    if (!isTrustedMainWindowIpc(event)) return untrustedSender('capabilities');
    return platform.snapshot();
  });

  ipcMain.handle('mineradio-wallpaper-set-enabled', async (event, enabled, payload) => {
    const operation = enabled === true ? 'enable' : 'disable';
    const denied = authorize(event, operation);
    if (denied) return denied;
    if (typeof enabled !== 'boolean') return invalidPayload('setEnabled');
    const normalized = normalizePayload(payload, operation);
    if (normalized.ok !== true) return normalized;
    try {
      if (enabled) return await platform.desktopMode.enable(normalized.value);
      return await platform.desktopMode.disable(normalized.value.reason || 'renderer-disabled');
    } catch (_) {
      return failedOperation(operation);
    }
  });

  ipcMain.handle('mineradio-wallpaper-update', async (event, payload) => {
    const operation = 'updateStatus';
    const denied = authorize(event, operation);
    if (denied) return denied;
    const normalized = normalizePayload(payload, operation);
    if (normalized.ok !== true) return normalized;
    try {
      return await platform.desktopMode.getStatus(normalized.value.reason || 'renderer-update');
    } catch (_) {
      return failedOperation(operation);
    }
  });

  ipcMain.handle('mineradio-wallpaper-get-status', async (event) => {
    const operation = 'getStatus';
    const denied = authorize(event, operation);
    if (denied) return denied;
    try {
      return await platform.desktopMode.getStatus('renderer-query');
    } catch (_) {
      return failedOperation(operation);
    }
  });

  let disposed = false;
  return function disposePlatformIpc() {
    if (disposed) return;
    disposed = true;
    PLATFORM_CHANNELS.forEach(channel => ipcMain.removeHandler(channel));
  };
}

module.exports = {
  PLATFORM_CHANNELS,
  registerPlatformIpc,
};
