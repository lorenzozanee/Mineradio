'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createWindowIpcAuthorization,
  isTrustedTopFrameSender,
} = require('../../desktop/shared/window-ipc-authorization');

function createWindow(url) {
  const webContents = {
    isDestroyed() { return false; },
    getURL() { return url; },
  };
  return {
    webContents,
    isDestroyed() { return false; },
  };
}

function eventFor(win, url, parent = null) {
  return { sender: win.webContents, senderFrame: { url, parent } };
}

test('trusted window sender requires the exact webContents, top frame, and validated URL', function() {
  const win = createWindow('http://127.0.0.1:3000/');
  const trustedUrl = function(url) { return url === 'http://127.0.0.1:3000/'; };
  assert.equal(isTrustedTopFrameSender(eventFor(win, trustedUrl.name), win, trustedUrl), false);
  assert.equal(isTrustedTopFrameSender(eventFor(win, 'http://127.0.0.1:3000/'), win, trustedUrl), true);
  assert.equal(isTrustedTopFrameSender(eventFor(win, 'http://127.0.0.1:3000/', {}), win, trustedUrl), false);
  assert.equal(isTrustedTopFrameSender(eventFor(win, 'http://127.0.0.1:3001/'), win, trustedUrl), false);
  assert.equal(isTrustedTopFrameSender({ sender: createWindow('http://127.0.0.1:3000/').webContents }, win, trustedUrl), false);
});

test('destroyed windows and webContents fail closed', function() {
  const win = createWindow('http://127.0.0.1:3000/');
  win.isDestroyed = function() { return true; };
  assert.equal(isTrustedTopFrameSender(eventFor(win, 'http://127.0.0.1:3000/'), win, function() { return true; }), false);
  win.isDestroyed = function() { return false; };
  win.webContents.isDestroyed = function() { return true; };
  assert.equal(isTrustedTopFrameSender(eventFor(win, 'http://127.0.0.1:3000/'), win, function() { return true; }), false);
});

test('overlay channels accept only the overlay window while all other channels require main', function() {
  const main = createWindow('http://127.0.0.1:3000/');
  const overlay = createWindow('http://127.0.0.1:3000/desktop-lyrics.html');
  const authorization = createWindowIpcAuthorization({
    getMainWindow: function() { return main; },
    getOverlayWindow: function() { return overlay; },
    isTrustedMainUrl: function(url) { return url === 'http://127.0.0.1:3000/'; },
    isTrustedOverlayUrl: function(url) { return url === 'http://127.0.0.1:3000/desktop-lyrics.html'; },
    overlayChannels: ['lyrics-move'],
  });
  assert.equal(authorization.authorize(eventFor(main, 'http://127.0.0.1:3000/'), 'account-export'), true);
  assert.equal(authorization.authorize(eventFor(overlay, 'http://127.0.0.1:3000/desktop-lyrics.html'), 'lyrics-move'), true);
  assert.equal(authorization.authorize(eventFor(overlay, 'http://127.0.0.1:3000/desktop-lyrics.html'), 'account-export'), false);
  assert.equal(authorization.authorize(eventFor(main, 'http://127.0.0.1:3000/'), 'lyrics-move'), true);
});
