'use strict';

const { INVALID, validateBoundedString } = require('./ipc-payload-validation');

const policyBrand = new WeakSet();
const PROVIDER_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const RESERVED_PROVIDER_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

function invalid() {
  return { ok: false, error: INVALID };
}

function assertValidPolicy(condition) {
  if (!condition) throw new Error('Invalid external navigation policy');
}

function normalizeHost(host) {
  assertValidPolicy(typeof host === 'string' && host.length > 0 && host.length <= 253 && host === host.toLowerCase());
  let parsed;
  try {
    parsed = new URL(`https://${host}`);
  } catch (_) {
    throw new Error('Invalid external navigation policy');
  }
  assertValidPolicy(
    parsed.protocol === 'https:'
    && parsed.username === ''
    && parsed.password === ''
    && parsed.port === ''
    && parsed.pathname === '/'
    && parsed.search === ''
    && parsed.hash === ''
    && parsed.hostname === host
    && parsed.host === host
  );
  return host;
}

function normalizeHostList(hosts, requireNonEmpty) {
  assertValidPolicy(Array.isArray(hosts));
  assertValidPolicy((requireNonEmpty ? hosts.length > 0 : true) && hosts.length <= 32);
  const normalized = hosts.map(normalizeHost);
  assertValidPolicy(new Set(normalized).size === normalized.length);
  return Object.freeze(normalized);
}

function createExternalNavigationPolicy(options = {}) {
  assertValidPolicy(options !== null && typeof options === 'object' && !Array.isArray(options));
  assertValidPolicy(Object.getPrototypeOf(options) === Object.prototype);
  const allowedHosts = normalizeHostList(options.allowedHosts, true);
  const maxLength = options.maxLength == null ? 2048 : options.maxLength;
  assertValidPolicy(Number.isSafeInteger(maxLength) && maxLength >= 1 && maxLength <= 4096);

  const providerInput = options.providers == null ? {} : options.providers;
  assertValidPolicy(Object.getPrototypeOf(providerInput) === Object.prototype);
  const providers = {};
  for (const provider of Object.keys(providerInput)) {
    assertValidPolicy(PROVIDER_NAME.test(provider) && !RESERVED_PROVIDER_NAMES.has(provider));
    providers[provider] = normalizeHostList(providerInput[provider], true);
  }
  const policy = Object.freeze({
    allowedHosts,
    providers: Object.freeze(providers),
    maxLength,
  });
  policyBrand.add(policy);
  return policy;
}

function hostsFor(policy, provider) {
  if (provider === undefined) return policy.allowedHosts;
  if (typeof provider !== 'string' || !Object.hasOwn(policy.providers, provider)) return null;
  return policy.providers[provider];
}

function validateExternalNavigation(value, policy, provider) {
  if (!policyBrand.has(policy)) return invalid();
  const url = validateBoundedString(value, { minLength: 1, maxLength: policy.maxLength });
  const hosts = hostsFor(policy, provider);
  if (!url.ok || !hosts || value !== value.trim()) return invalid();
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    return invalid();
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || !hosts.includes(parsed.hostname)
  ) {
    return invalid();
  }
  return { ok: true, url: parsed.href };
}

module.exports = {
  INVALID,
  createExternalNavigationPolicy,
  validateExternalNavigation,
};
