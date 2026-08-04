'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createPathIdentity } = require('../../desktop/shared/path-identity');

test('case-sensitive path identity preserves case for macOS semantics', () => {
  const identity = createPathIdentity({ caseInsensitive: false });
  const upper = path.resolve('/synthetic/Music/Song.flac');
  const lower = path.resolve('/synthetic/music/song.flac');
  assert.equal(identity(upper), upper);
  assert.equal(identity(lower), lower);
  assert.notEqual(identity(upper), identity(lower));
});

test('case-insensitive path identity folds case for Windows semantics', () => {
  const identity = createPathIdentity({ caseInsensitive: true });
  const upper = path.resolve('/synthetic/Music/Song.flac');
  const lower = path.resolve('/synthetic/music/song.flac');
  assert.equal(identity(upper), identity(lower));
});

test('path identity rejects relative and empty values', () => {
  const identity = createPathIdentity({ caseInsensitive: false });
  assert.equal(identity(''), '');
  assert.equal(identity('../escape'), '');
});
