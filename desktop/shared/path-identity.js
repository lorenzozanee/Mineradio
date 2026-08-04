'use strict';

const path = require('path');

function createPathIdentity(options = {}) {
  const caseInsensitive = options.caseInsensitive === true;
  return function pathIdentity(value) {
    const input = String(value || '').trim();
    if (!input || !path.isAbsolute(input)) return '';
    const resolved = path.resolve(input);
    return caseInsensitive ? resolved.toLowerCase() : resolved;
  };
}

module.exports = { createPathIdentity };
