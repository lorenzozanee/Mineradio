'use strict';

const path = require('path');

function resolveStartupQaUserDataPath(env = process.env) {
  if (env.MINERADIO_STARTUP_QA_HIDDEN !== '1' && env.MINERADIO_STARTUP_QA_ISOLATED !== '1') return '';
  const value = String(env.MINERADIO_STARTUP_QA_USER_DATA || '').trim();
  if (!value || !path.isAbsolute(value)) return '';
  return path.resolve(value);
}

module.exports = { resolveStartupQaUserDataPath };
