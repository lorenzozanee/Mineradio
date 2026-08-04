'use strict';

const { createMacConfiguration } = require('./build/macos/configuration');

module.exports = createMacConfiguration(process.env);
