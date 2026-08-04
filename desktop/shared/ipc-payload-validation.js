'use strict';

const INVALID = 'INVALID';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function invalid() {
  return { ok: false, error: INVALID };
}

function valid(value) {
  return { ok: true, value };
}

function positiveInteger(value, fallback) {
  if (value == null) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function clonePlainValue(value, options, state, depth) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype || state.ancestors.has(value)) return null;
  if (depth >= options.maxDepth || Object.getOwnPropertySymbols(value).length > 0) return null;

  const keys = Object.keys(value);
  if (keys.length > options.maxKeys || state.entries + keys.length > options.maxEntries) return null;
  state.entries += keys.length;
  state.ancestors.add(value);
  const copy = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || UNSAFE_KEYS.has(key)) {
      state.ancestors.delete(value);
      return null;
    }
    const cloned = clonePlainValue(descriptor.value, options, state, depth + 1);
    if (cloned === null && descriptor.value !== null) {
      state.ancestors.delete(value);
      return null;
    }
    copy[key] = cloned;
  }
  state.ancestors.delete(value);
  return copy;
}

function validatePlainRecord(value, options = {}) {
  const maxKeys = positiveInteger(options.maxKeys, 32);
  const maxEntries = positiveInteger(options.maxEntries, 128);
  const maxDepth = positiveInteger(options.maxDepth, 4);
  if (maxKeys == null || maxEntries == null || maxDepth == null || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid();
  }
  const copy = clonePlainValue(value, { maxKeys, maxEntries, maxDepth }, { entries: 0, ancestors: new Set() }, 0);
  if (copy === null) return invalid();
  return valid(copy);
}

function validateBoundedString(value, options = {}) {
  const minLength = positiveInteger(options.minLength, 0);
  const maxLength = positiveInteger(options.maxLength, 1024);
  if (minLength == null || maxLength == null || minLength > maxLength || typeof value !== 'string') return invalid();
  if (value.length < minLength || value.length > maxLength || CONTROL_CHARACTERS.test(value)) return invalid();
  return valid(value);
}

function validateFiniteNumber(value, options = {}) {
  const min = options.min == null ? Number.MIN_SAFE_INTEGER : options.min;
  const max = options.max == null ? Number.MAX_SAFE_INTEGER : options.max;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || !Number.isFinite(value)) return invalid();
  if (value < min || value > max) return invalid();
  return valid(value);
}

function validateRect(value, options = {}) {
  const coordinateLimit = options.coordinateLimit == null ? 1000000 : options.coordinateLimit;
  const dimensionLimit = options.dimensionLimit == null ? 1000000 : options.dimensionLimit;
  if (!Number.isFinite(coordinateLimit) || !Number.isFinite(dimensionLimit) || coordinateLimit < 0 || dimensionLimit < 0) {
    return invalid();
  }
  const record = validatePlainRecord(value, { maxKeys: 4, maxEntries: 4, maxDepth: 1 });
  if (!record.ok) return record;
  const keys = Object.keys(record.value).sort();
  if (keys.join(',') !== 'height,width,x,y') return invalid();
  const x = validateFiniteNumber(record.value.x, { min: -coordinateLimit, max: coordinateLimit });
  const y = validateFiniteNumber(record.value.y, { min: -coordinateLimit, max: coordinateLimit });
  const width = validateFiniteNumber(record.value.width, { min: 0, max: dimensionLimit });
  const height = validateFiniteNumber(record.value.height, { min: 0, max: dimensionLimit });
  if (!x.ok || !y.ok || !width.ok || !height.ok) return invalid();
  return valid({ x: x.value, y: y.value, width: width.value, height: height.value });
}

module.exports = {
  INVALID,
  validateBoundedString,
  validateFiniteNumber,
  validatePlainRecord,
  validateRect,
};
