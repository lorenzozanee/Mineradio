'use strict';

const os = require('os');

const MEMORY_MASK_DEFAULT = 29;

function getMemorySnapshot() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total > free ? total - free : 0;
  const usage = process.memoryUsage();
  return {
    platform: 'darwin',
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    totalMB: Math.round(total / 1048576),
    freeMB: Math.round(free / 1048576),
    usedMB: Math.round(used / 1048576),
    usedPercent: total > 0 ? Math.round(used * 100 / total) : 0,
    process: {
      rssMB: Math.round(usage.rss / 1048576),
      heapMB: Math.round(usage.heapUsed / 1048576),
    },
  };
}

function unsupported(operation) {
  return Promise.resolve({
    ok: false,
    unsupported: true,
    operation,
    error: 'PLATFORM_CAPABILITY_UNSUPPORTED',
  });
}

module.exports = Object.freeze({
  MEMORY_MASK_DEFAULT,
  SYSTEM_PURGE_AVAILABLE: false,
  SYSTEM_PURGE_ENABLED: false,
  setNativeTempPath: () => ({ ok: true }),
  getMemorySnapshot,
  getMemorySnapshotExtended: async () => getMemorySnapshot(),
  normalizeMask: () => MEMORY_MASK_DEFAULT,
  probeProcessElevation: async () => false,
  isProcessElevated: async () => false,
  purgeSystemMemorySmart: () => unsupported('purgeSystemMemorySmart'),
  trimAppWorkingSets: () => unsupported('trimAppWorkingSets'),
});
