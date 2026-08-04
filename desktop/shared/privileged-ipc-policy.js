'use strict';

const policies = Object.create(null);

function define(channels, descriptors) {
  for (const channel of channels) policies[channel] = Object.freeze(descriptors.slice());
}

define([
  'desktop-window-minimize',
  'desktop-window-restore',
  'desktop-window-toggle-maximize',
  'desktop-window-toggle-fullscreen',
  'desktop-window-exit-fullscreen-windowed',
  'desktop-window-get-state',
  'mineradio-get-gpu-diagnostics',
  'mineradio-memory-get-snapshot',
  'mineradio-cache-get-settings',
  'mineradio-cache-choose-directory',
  'mineradio-wallpaper-engine-choose-directory',
  'mineradio-wallpaper-engine-choose-project-file',
  'mineradio-local-library-list',
  'desktop-window-get-close-behavior',
  'mineradio-import-json-file',
  'mineradio-current-fx-autosave-read-sync',
  'mineradio-login-easter-egg-status',
  'mineradio-login-easter-egg-reset',
  'netease-music-open-login',
  'netease-music-clear-login',
  'qq-music-clear-login',
  'kugou-music-open-login',
  'kugou-music-clear-login',
  'qishui-music-clear-login',
  'spotify-music-open-login',
  'spotify-music-clear-login',
  'mineradio-restart-app',
  'mineradio-desktop-lyrics-set-dragging',
], []);

define([
  'mineradio-full-desktop-icon-shields',
  'mineradio-memory-configure-auto',
  'mineradio-memory-trim-app',
  'mineradio-memory-purge-system',
  'mineradio-cache-set-settings',
  'mineradio-wallpaper-engine-list',
  'mineradio-wallpaper-engine-runtime-status',
  'mineradio-wallpaper-engine-start-scene',
  'mineradio-wallpaper-engine-capture-result',
  'mineradio-wallpaper-engine-prepare-glass-capture',
  'mineradio-wallpaper-engine-activate-dwm-surface',
  'mineradio-wallpaper-engine-glass-surface',
  'mineradio-wallpaper-engine-pointer-activity',
  'mineradio-wallpaper-engine-stop-scene',
  'mineradio-local-library-authorize',
  'mineradio-local-library-import',
  'mineradio-export-json-file',
  'mineradio-current-fx-autosave-save-sync',
  'mineradio-current-fx-autosave-save',
  'qq-music-open-login',
  'mineradio-desktop-lyrics-update',
  'mineradio-desktop-lyrics-set-hot-bounds',
], ['record']);

define([
  'mineradio-full-desktop-pointer-route',
  'mineradio-wallpaper-engine-open-project-details',
], ['record']);

define([
  'mineradio-full-desktop-set-icons-visible',
  'mineradio-full-desktop-set-software-lock',
  'mineradio-desktop-lyrics-set-pointer-capture',
  'mineradio-desktop-lyrics-set-lock-state',
], ['boolean']);

define([
  'mineradio-full-desktop-request-keyboard-focus',
  'mineradio-wallpaper-engine-project-details',
  'mineradio-wallpaper-engine-remove-directory',
  'mineradio-local-library-lyric',
  'mineradio-cache-read-lyric',
  'desktop-window-set-close-behavior',
  'mineradio-export-login-cookie',
  'mineradio-login-easter-egg-unlock',
  'mineradio-open-update-page',
], ['string']);

define(['desktop-window-close'], ['optional-string']);
define(['mineradio-cache-write-lyric'], ['string', 'record']);
define(['mineradio-hotkeys-configure-global'], ['array']);
define(['mineradio-desktop-lyrics-set-enabled'], ['boolean', 'record']);
define(['mineradio-desktop-lyrics-move-by'], ['number', 'number']);

const PRIVILEGED_IPC_POLICIES = Object.freeze(policies);

function matchesDescriptor(value, descriptor) {
  if (descriptor === 'optional-string') return value == null || typeof value === 'string';
  if (descriptor === 'string') return typeof value === 'string';
  if (descriptor === 'boolean') return typeof value === 'boolean';
  if (descriptor === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (descriptor === 'array') return Array.isArray(value);
  if (descriptor === 'record') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  return false;
}

function validatePrivilegedIpcArguments(channel, args) {
  const descriptors = PRIVILEGED_IPC_POLICIES[channel];
  if (!descriptors || !Array.isArray(args) || args.length !== descriptors.length) return false;
  return descriptors.every(function(descriptor, index) {
    return matchesDescriptor(args[index], descriptor);
  });
}

module.exports = {
  PRIVILEGED_IPC_POLICIES,
  validatePrivilegedIpcArguments,
};
