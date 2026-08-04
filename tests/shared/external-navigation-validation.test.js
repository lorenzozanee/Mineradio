'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INVALID,
  createExternalNavigationPolicy,
  validateExternalNavigation,
} = require('../../desktop/shared/external-navigation-validation');

const policy = createExternalNavigationPolicy({
  allowedHosts: ['mineradio.example'],
  providers: {
    spotify: ['open.spotify.com'],
    netease: ['music.163.com'],
  },
  maxLength: 120,
});

function assertInvalid(result) {
  assert.deepEqual(result, { ok: false, error: INVALID });
  assert.deepEqual(Object.keys(result).sort(), ['error', 'ok']);
}

test('navigation policy is immutable and only contains normalized trusted hosts', () => {
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(policy.allowedHosts), true);
  assert.equal(Object.isFrozen(policy.providers), true);
  assert.deepEqual(policy.allowedHosts, ['mineradio.example']);
  assert.deepEqual(policy.providers.spotify, ['open.spotify.com']);
});

test('external navigation permits only exact HTTPS hosts and returns a serializable URL', () => {
  const result = validateExternalNavigation('https://mineradio.example/updates?a=1', policy);
  assert.deepEqual(result, { ok: true, url: 'https://mineradio.example/updates?a=1' });
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('external navigation compares URL hosts case-insensitively through URL normalization', () => {
  assert.deepEqual(
    validateExternalNavigation('https://MINERADIO.EXAMPLE/updates', policy),
    { ok: true, url: 'https://mineradio.example/updates' }
  );
});

test('external navigation requires an explicit controlled provider for provider hosts', () => {
  assertInvalid(validateExternalNavigation('https://open.spotify.com/authorize', policy));
  assert.deepEqual(
    validateExternalNavigation('https://open.spotify.com/authorize', policy, 'spotify'),
    { ok: true, url: 'https://open.spotify.com/authorize' }
  );
});

test('external navigation prevents provider confusion and prototype lookup', () => {
  [undefined, '', 'unknown', '__proto__', 'constructor', 'spotify\n'].forEach(provider => {
    assertInvalid(validateExternalNavigation('https://open.spotify.com/authorize', policy, provider));
  });
  assertInvalid(validateExternalNavigation('https://music.163.com/', policy, 'spotify'));
});

test('external navigation rejects non-HTTPS schemes and malformed URLs', () => {
  [
    'http://mineradio.example/',
    'file:///tmp/private',
    'javascript:alert(1)',
    'mailto:person@mineradio.example',
    'https://',
    'not a url',
  ].forEach(url => assertInvalid(validateExternalNavigation(url, policy)));
});

test('external navigation rejects credentials, ports, subdomains, and lookalike hosts', () => {
  [
    'https://user@mineradio.example/path',
    'https://user:password@mineradio.example/path',
    'https://mineradio.example:444/path',
    'https://sub.mineradio.example/path',
    'https://mineradio.example.evil.test/path',
    'https://mineradio.example@evil.test/path',
  ].forEach(url => assertInvalid(validateExternalNavigation(url, policy)));
});

test('external navigation rejects controls, non-strings, and overlong input before side effects', () => {
  [
    null,
    undefined,
    {},
    [],
    'https://mineradio.example/line\nbreak',
    'https://mineradio.example/nul\u0000byte',
    `https://mineradio.example/${'x'.repeat(100)}`,
  ].forEach(url => assertInvalid(validateExternalNavigation(url, policy)));
});

test('external navigation refuses unbranded or malformed policies', () => {
  assertInvalid(validateExternalNavigation('https://mineradio.example/', {}));
  assertInvalid(validateExternalNavigation('https://mineradio.example/', {
    allowedHosts: ['mineradio.example'],
    providers: {},
    maxLength: 2048,
  }));
});

test('policy creation rejects unsafe host and provider configuration', () => {
  [
    { allowedHosts: ['https://mineradio.example'] },
    { allowedHosts: ['Mineradio.example'] },
    { allowedHosts: ['mineradio.example:443'] },
    { allowedHosts: ['mineradio.example/path'] },
    { allowedHosts: [] },
    { allowedHosts: ['mineradio.example'], providers: [] },
    { allowedHosts: ['mineradio.example'], providers: { spotify: ['open.spotify.com', 'open.spotify.com'] } },
    { allowedHosts: ['mineradio.example'], providers: { __proto__: ['evil.test'] } },
    Object.assign(Object.create(null), { allowedHosts: ['mineradio.example'] }),
    { allowedHosts: ['mineradio.example'], maxLength: 0 },
  ].forEach(options => assert.throws(() => createExternalNavigationPolicy(options), /invalid external navigation policy/i));
});
