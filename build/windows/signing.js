'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const UNSIGNED_LOCAL_BUILD = '1';
const DEFAULT_TIMESTAMP_URL = 'https://timestamp.digicert.com';

function readWindowsSigningConfig(env = process.env, existsSync = fs.existsSync) {
  if (env.MINERADIO_ALLOW_UNSIGNED_WINDOWS_BUILD === UNSIGNED_LOCAL_BUILD) {
    if (env.CI) throw new Error('Unsigned Windows builds are not permitted in CI.');
    return { unsigned: true };
  }
  const certificatePath = String(env.WINDOWS_CERTIFICATE_PATH || '').trim();
  const password = String(env.WINDOWS_CERTIFICATE_PASSWORD || '');
  const timestampUrl = String(env.WINDOWS_TIMESTAMP_URL || DEFAULT_TIMESTAMP_URL).trim();
  if (!certificatePath || !path.isAbsolute(certificatePath) || !existsSync(certificatePath)) {
    throw new Error('WINDOWS_CERTIFICATE_PATH must reference an existing absolute PFX file.');
  }
  if (!password) throw new Error('WINDOWS_CERTIFICATE_PASSWORD is required.');
  let timestamp;
  try { timestamp = new URL(timestampUrl); } catch (_) { throw new Error('WINDOWS_TIMESTAMP_URL must be a valid HTTPS URL.'); }
  if (timestamp.protocol !== 'https:' || timestamp.username || timestamp.password) {
    throw new Error('WINDOWS_TIMESTAMP_URL must be a credential-free HTTPS URL.');
  }
  return { unsigned: false, certificatePath, password, timestampUrl: timestamp.href };
}

function resolveSignTool(run = execFileSync) {
  const script = [
    '$candidate = Get-Command signtool.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source',
    'if (-not $candidate) {',
    "  $candidate = Get-ChildItem '${env:ProgramFiles(x86)}\\Windows Kits\\10\\bin\\*\\x64\\signtool.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName",
    '}',
    'if (-not $candidate) { exit 1 }',
    '[Console]::Out.Write($candidate)',
  ].join('\n');
  const result = String(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }) || '').trim();
  if (!result || !path.win32.isAbsolute(result)) throw new Error('Windows SDK signtool.exe was not found.');
  return result;
}

function signWindowsFile(filePath, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'win32') throw new Error(`Windows signing requires win32; current platform is ${platform}.`);
  const existsSync = options.existsSync || fs.existsSync;
  if (!path.isAbsolute(filePath) || !existsSync(filePath)) throw new Error(`Windows signing target is missing: ${filePath}`);
  const config = readWindowsSigningConfig(options.env || process.env, existsSync);
  if (config.unsigned) return { ok: true, unsigned: true, filePath };
  const run = options.run || execFileSync;
  const signTool = options.signTool || resolveSignTool(run);
  run(signTool, [
    'sign',
    '/fd', 'SHA256',
    '/tr', config.timestampUrl,
    '/td', 'SHA256',
    '/f', config.certificatePath,
    '/p', config.password,
    filePath,
  ], { stdio: 'inherit', windowsHide: true });
  run(signTool, ['verify', '/pa', '/all', filePath], { stdio: 'inherit', windowsHide: true });
  return { ok: true, unsigned: false, filePath };
}

module.exports = {
  DEFAULT_TIMESTAMP_URL,
  readWindowsSigningConfig,
  resolveSignTool,
  signWindowsFile,
};
