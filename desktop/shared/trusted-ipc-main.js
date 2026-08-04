'use strict';

const DEFAULT_LIMITS = Object.freeze({
  maxArguments: 4,
  maxDepth: 8,
  maxEntries: 20000,
  maxStringBytes: 12 * 1024 * 1024,
  maxTotalBytes: 16 * 1024 * 1024,
});

function rejectedIpc(error, channel) {
  return {
    ok: false,
    error,
    channel: String(channel || '').slice(0, 128),
  };
}

function validateIpcArguments(args, customLimits = {}) {
  const limits = { ...DEFAULT_LIMITS, ...customLimits };
  if (!Array.isArray(args) || args.length > limits.maxArguments) return false;
  const seen = new Set();
  let entries = 0;
  let bytes = 0;

  function visit(value, depth) {
    if (depth > limits.maxDepth) return false;
    if (value == null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') {
      const size = Buffer.byteLength(value, 'utf8');
      bytes += size;
      return size <= limits.maxStringBytes && bytes <= limits.maxTotalBytes;
    }
    if (typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const isArray = Array.isArray(value);
    if (!isArray) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return false;
    }
    const keys = isArray ? value.keys() : Object.keys(value);
    for (const key of keys) {
      entries += 1;
      if (entries > limits.maxEntries) return false;
      if (!isArray) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
        bytes += Buffer.byteLength(key, 'utf8');
        if (bytes > limits.maxTotalBytes) return false;
      }
      if (!visit(value[key], depth + 1)) return false;
    }
    return true;
  }

  return visit(args, 0);
}

function createTrustedIpcMain(options = {}) {
  const ipcMain = options.ipcMain;
  const authorize = options.authorize;
  const validateArguments = options.validateArguments || validateIpcArguments;
  const validateChannelArguments = options.validateChannelArguments || function() { return true; };
  if (!ipcMain || typeof ipcMain.handle !== 'function' || typeof ipcMain.on !== 'function') {
    throw new Error('Trusted IPC registration requires ipcMain.handle and ipcMain.on');
  }
  if (typeof authorize !== 'function') throw new Error('Trusted IPC registration requires an authorize function');

  return Object.freeze({
    handle(channel, handler) {
      if (typeof handler !== 'function') throw new Error(`IPC handler must be a function: ${channel}`);
      ipcMain.handle(channel, function(event, ...args) {
        if (!authorize(event, channel)) return rejectedIpc('IPC_UNTRUSTED_SENDER', channel);
        if (!validateArguments(args) || !validateChannelArguments(channel, args)) {
          return rejectedIpc('IPC_PAYLOAD_INVALID', channel);
        }
        return handler(event, ...args);
      });
    },
    on(channel, listener) {
      if (typeof listener !== 'function') throw new Error(`IPC listener must be a function: ${channel}`);
      ipcMain.on(channel, function(event, ...args) {
        if (!authorize(event, channel)) {
          event.returnValue = rejectedIpc('IPC_UNTRUSTED_SENDER', channel);
          return;
        }
        if (!validateArguments(args) || !validateChannelArguments(channel, args)) {
          event.returnValue = rejectedIpc('IPC_PAYLOAD_INVALID', channel);
          return;
        }
        listener(event, ...args);
      });
    },
  });
}

module.exports = {
  DEFAULT_LIMITS,
  createTrustedIpcMain,
  rejectedIpc,
  validateIpcArguments,
};
