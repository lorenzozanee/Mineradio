'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PRIVILEGED_IPC_POLICIES,
  validatePrivilegedIpcArguments,
} = require('../../desktop/shared/privileged-ipc-policy');

test('every trusted main-process IPC registration has an explicit argument policy', function() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../desktop/main.js'), 'utf8');
  const channels = Array.from(source.matchAll(/trustedIpcMain\.(?:handle|on)\('([^']+)'/g), function(match) {
    return match[1];
  }).sort();
  assert.ok(channels.length >= 65);
  assert.deepEqual(Object.keys(PRIVILEGED_IPC_POLICIES).sort(), channels);
});

test('privileged IPC policies require exact arity and primitive types', function() {
  assert.equal(validatePrivilegedIpcArguments('desktop-window-minimize', []), true);
  assert.equal(validatePrivilegedIpcArguments('desktop-window-minimize', [{}]), false);
  assert.equal(validatePrivilegedIpcArguments('mineradio-full-desktop-set-icons-visible', [true]), true);
  assert.equal(validatePrivilegedIpcArguments('mineradio-full-desktop-set-icons-visible', [1]), false);
  assert.equal(validatePrivilegedIpcArguments('mineradio-desktop-lyrics-move-by', [1, -2]), true);
  assert.equal(validatePrivilegedIpcArguments('mineradio-desktop-lyrics-move-by', [1, Number.NaN]), false);
});

test('privileged IPC policies reject arrays and custom prototypes where records are required', function() {
  assert.equal(validatePrivilegedIpcArguments('mineradio-cache-set-settings', [{}]), true);
  assert.equal(validatePrivilegedIpcArguments('mineradio-cache-set-settings', [[]]), false);
  assert.equal(validatePrivilegedIpcArguments('mineradio-cache-set-settings', [Object.create({ polluted: true })]), false);
  assert.equal(validatePrivilegedIpcArguments('unknown-channel', []), false);
});
