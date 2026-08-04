'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INVALID,
  validateBoundedString,
  validateFiniteNumber,
  validatePlainRecord,
  validateRect,
} = require('../../desktop/shared/ipc-payload-validation');

function assertInvalid(result) {
  assert.deepEqual(result, { ok: false, error: INVALID });
  assert.deepEqual(Object.keys(result).sort(), ['error', 'ok']);
}

test('validates a bounded plain record without changing its data', () => {
  const payload = {
    reason: 'renderer-update',
    nested: { retry: 2 },
  };
  const result = validatePlainRecord(payload, { maxKeys: 2, maxDepth: 2 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, payload);
  assert.notEqual(result.value, payload);
  assert.notEqual(result.value.nested, payload.nested);
});

test('plain record validator rejects null, arrays, primitives, and custom prototypes', () => {
  [null, [], 'payload', 1, true, new Date(), Object.create(null), new (class Payload {})()].forEach(value => {
    assertInvalid(validatePlainRecord(value));
  });
});

test('plain record validator rejects getters, symbols, and dangerous record keys', () => {
  const getter = {};
  Object.defineProperty(getter, 'reason', { enumerable: true, get() { return 'hidden'; } });
  const symbol = { reason: 'visible' };
  symbol[Symbol('hidden')] = 'hidden';
  const polluted = JSON.parse('{"__proto__":{"polluted":true}}');
  [getter, symbol, polluted, { constructor: 'nope' }, { prototype: 'nope' }].forEach(value => {
    assertInvalid(validatePlainRecord(value));
  });
});

test('plain record validator bounds keys, nesting, arrays, and cyclic data', () => {
  const cyclic = { reason: 'test' };
  cyclic.self = cyclic;
  const arrayNested = { values: ['test'] };
  const deeplyNested = { one: { two: { three: 'too-deep' } } };
  assertInvalid(validatePlainRecord({ one: 1, two: 2 }, { maxKeys: 1 }));
  assertInvalid(validatePlainRecord(cyclic));
  assertInvalid(validatePlainRecord(arrayNested));
  assertInvalid(validatePlainRecord(deeplyNested, { maxDepth: 2 }));
});

test('plain record validator applies the total entry bound across nested records', () => {
  assertInvalid(validatePlainRecord(
    { first: 1, nested: { second: 2, third: 3 } },
    { maxKeys: 3, maxEntries: 3, maxDepth: 2 }
  ));
});

test('plain record validator only permits JSON primitive leaves', () => {
  [
    { value: undefined },
    { value: BigInt(1) },
    { value: Number.NaN },
    { value: Infinity },
    { value: -Infinity },
    { value() {} },
  ].forEach(value => assertInvalid(validatePlainRecord(value)));
});

test('bounded string accepts inclusive limits and returns a copied string', () => {
  assert.deepEqual(validateBoundedString('ok', { minLength: 2, maxLength: 2 }), { ok: true, value: 'ok' });
  assert.deepEqual(validateBoundedString('', { minLength: 0, maxLength: 0 }), { ok: true, value: '' });
});

test('bounded string rejects non-strings, out-of-range lengths, and control characters', () => {
  [null, undefined, 1, false, {}, [], '', 'a', 'abc', 'line\nbreak', 'nul\u0000byte', 'tab\tvalue', 'del\u007fvalue'].forEach(value => {
    assertInvalid(validateBoundedString(value, { minLength: 2, maxLength: 2 }));
  });
  assertInvalid(validateBoundedString('line\nbreak'));
  assertInvalid(validateBoundedString('nul\u0000byte'));
});

test('bounded number accepts finite inclusive bounds and rejects unsafe values', () => {
  assert.deepEqual(validateFiniteNumber(-5, { min: -5, max: 5 }), { ok: true, value: -5 });
  assert.deepEqual(validateFiniteNumber(5, { min: -5, max: 5 }), { ok: true, value: 5 });
  [Number.NaN, Infinity, -Infinity, '1', null, undefined, 6, -6].forEach(value => {
    assertInvalid(validateFiniteNumber(value, { min: -5, max: 5 }));
  });
});

test('rect accepts finite in-range coordinates and non-negative dimensions', () => {
  assert.deepEqual(validateRect({ x: -10, y: 20, width: 0, height: 50 }, { coordinateLimit: 100, dimensionLimit: 100 }), {
    ok: true,
    value: { x: -10, y: 20, width: 0, height: 50 },
  });
});

test('rect rejects missing, extra, non-finite, out-of-range, and malformed values', () => {
  [
    null,
    [],
    { x: 0, y: 0, width: 1 },
    { x: 0, y: 0, width: 1, height: 1, z: 1 },
    { x: Number.NaN, y: 0, width: 1, height: 1 },
    { x: 101, y: 0, width: 1, height: 1 },
    { x: 0, y: -101, width: 1, height: 1 },
    { x: 0, y: 0, width: -1, height: 1 },
    { x: 0, y: 0, width: 1, height: Infinity },
    Object.assign(Object.create(null), { x: 0, y: 0, width: 1, height: 1 }),
  ].forEach(value => assertInvalid(validateRect(value, { coordinateLimit: 100, dimensionLimit: 100 })));
});
