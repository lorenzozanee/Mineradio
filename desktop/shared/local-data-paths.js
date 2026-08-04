'use strict';

const os = require('os');
const path = require('path');

function absoluteEnvironmentPath(value) {
  const input = String(value || '').trim();
  if (!input || !path.isAbsolute(input)) return '';
  return path.resolve(input);
}

function resolveServerLocalDataPaths(options = {}) {
  const env = options.env || process.env;
  const homeDirectory = absoluteEnvironmentPath(options.homeDirectory || os.homedir());
  if (!homeDirectory) throw new Error('SERVER_HOME_DIRECTORY_UNAVAILABLE');
  const dataDirectory = absoluteEnvironmentPath(env.MINERADIO_USER_DATA)
    || path.join(homeDirectory, '.mineradio');

  return Object.freeze({
    dataDirectory,
    neteaseCookie: absoluteEnvironmentPath(env.COOKIE_FILE) || path.join(dataDirectory, '.cookie'),
    qqCookie: absoluteEnvironmentPath(env.QQ_COOKIE_FILE) || path.join(dataDirectory, '.qq-cookie'),
    kugouCookie: absoluteEnvironmentPath(env.KUGOU_COOKIE_FILE) || path.join(dataDirectory, '.kugou-cookie'),
    qishuiCookie: absoluteEnvironmentPath(env.QISHUI_COOKIE_FILE) || path.join(dataDirectory, '.qishui-cookie'),
    beatmapCache: absoluteEnvironmentPath(env.MINERADIO_BEAT_CACHE_DIR) || path.join(dataDirectory, 'beatmaps'),
    cuefieldFeedback: absoluteEnvironmentPath(env.CUEFIELD_FEEDBACK_FILE)
      || path.join(dataDirectory, 'cuefield-feedback.jsonl'),
    listenSyncJournal: absoluteEnvironmentPath(env.MINERADIO_LISTEN_SYNC_FILE)
      || path.join(dataDirectory, 'listen-sync-journal.json'),
  });
}

module.exports = {
  absoluteEnvironmentPath,
  resolveServerLocalDataPaths,
};
