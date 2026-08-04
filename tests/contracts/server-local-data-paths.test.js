'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  absoluteEnvironmentPath,
  resolveServerLocalDataPaths,
} = require('../../desktop/shared/local-data-paths');

test('server local data defaults remain inside one cross-platform home directory', () => {
  const homeDirectory = path.resolve('/synthetic/home');
  const paths = resolveServerLocalDataPaths({ env: {}, homeDirectory });
  assert.equal(paths.dataDirectory, path.join(homeDirectory, '.mineradio'));
  for (const [name, value] of Object.entries(paths)) {
    if (name === 'dataDirectory') continue;
    assert.equal(path.relative(paths.dataDirectory, value).startsWith('..'), false, name);
    assert.equal(path.isAbsolute(value), true, name);
  }
  assert.equal(Object.isFrozen(paths), true);
});

test('server local data uses an explicit absolute owned directory', () => {
  const ownedDirectory = path.resolve('/synthetic/owned-profile');
  const paths = resolveServerLocalDataPaths({
    env: { MINERADIO_USER_DATA: ownedDirectory },
    homeDirectory: path.resolve('/synthetic/home'),
  });
  assert.equal(paths.dataDirectory, ownedDirectory);
  assert.equal(paths.neteaseCookie, path.join(ownedDirectory, '.cookie'));
  assert.equal(paths.beatmapCache, path.join(ownedDirectory, 'beatmaps'));
});

test('server local data accepts bounded explicit absolute file locations', () => {
  const explicit = path.resolve('/synthetic/overrides/qq.cookie');
  const paths = resolveServerLocalDataPaths({
    env: { QQ_COOKIE_FILE: explicit },
    homeDirectory: path.resolve('/synthetic/home'),
  });
  assert.equal(paths.qqCookie, explicit);
});

test('server local data rejects relative environment paths and unavailable homes', () => {
  const paths = resolveServerLocalDataPaths({
    env: { MINERADIO_USER_DATA: '../escape', COOKIE_FILE: 'relative-cookie' },
    homeDirectory: path.resolve('/synthetic/home'),
  });
  assert.equal(paths.dataDirectory, path.resolve('/synthetic/home/.mineradio'));
  assert.equal(paths.neteaseCookie, path.resolve('/synthetic/home/.mineradio/.cookie'));
  assert.equal(absoluteEnvironmentPath('relative'), '');
  assert.throws(
    () => resolveServerLocalDataPaths({ env: {}, homeDirectory: 'relative' }),
    /SERVER_HOME_DIRECTORY_UNAVAILABLE/
  );
});
