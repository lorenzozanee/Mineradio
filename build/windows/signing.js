'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');

const UNSIGNED_LOCAL_BUILD = '1';
const DEFAULT_TIMESTAMP_URL = 'https://timestamp.digicert.com';

function normalizeThumbprint(value) {
  const thumbprint = String(value || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-F0-9]{40}$/.test(thumbprint)) {
    throw new Error('WINDOWS_CERTIFICATE_SHA1 must be the expected 40-character certificate thumbprint.');
  }
  return thumbprint;
}

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
  const expectedThumbprint = normalizeThumbprint(env.WINDOWS_CERTIFICATE_SHA1);
  let timestamp;
  try { timestamp = new URL(timestampUrl); } catch (_) { throw new Error('WINDOWS_TIMESTAMP_URL must be a valid HTTPS URL.'); }
  if (timestamp.protocol !== 'https:' || timestamp.username || timestamp.password) {
    throw new Error('WINDOWS_TIMESTAMP_URL must be a credential-free HTTPS URL.');
  }
  return { unsigned: false, certificatePath, password, expectedThumbprint, timestampUrl: timestamp.href };
}

function resolveSignTool(run = execFileSync) {
  const script = [
    '$candidate = Get-Command signtool.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source',
    'if (-not $candidate) {',
    "  $sdkBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\\10\\bin'",
    '  $candidate = Get-ChildItem $sdkBin -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match \'\\\\x64\\\\signtool\\.exe$\' } | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName',
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

function importWindowsCertificate(config, run = execFileSync) {
  const storeName = `MineradioSigning-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$storePath = 'Cert:\\CurrentUser\\' + $env:MINERADIO_WINDOWS_CERT_STORE",
    'try {',
    '  New-Item -Path $storePath -Force | Out-Null',
    '  $password = ConvertTo-SecureString -String $env:MINERADIO_WINDOWS_PFX_PASSWORD -AsPlainText -Force',
    '  $imported = @(Import-PfxCertificate -FilePath $env:MINERADIO_WINDOWS_PFX_PATH -CertStoreLocation $storePath -Password $password -Exportable:$false)',
    '  $signing = @($imported | Where-Object { $_.HasPrivateKey })',
    "  if ($signing.Count -ne 1) { throw 'PFX must contain exactly one certificate with a private key.' }",
    '  [Console]::Out.Write($signing[0].Thumbprint)',
    '} catch {',
    '  Remove-Item -LiteralPath $storePath -Recurse -Force -ErrorAction SilentlyContinue',
    '  throw',
    '}',
  ].join('\n');
  const output = String(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MINERADIO_WINDOWS_CERT_STORE: storeName,
      MINERADIO_WINDOWS_PFX_PATH: config.certificatePath,
      MINERADIO_WINDOWS_PFX_PASSWORD: config.password,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }) || '').trim();
  return { signingThumbprint: normalizeThumbprint(output), storeName };
}

function removeWindowsCertificateStore(storeName, run = execFileSync) {
  if (!/^MineradioSigning-[A-Za-z0-9-]+$/.test(String(storeName || ''))) {
    throw new Error('Refusing to remove an unexpected Windows certificate store.');
  }
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$storePath = 'Cert:\\CurrentUser\\' + $env:MINERADIO_WINDOWS_CERT_STORE",
    'Remove-Item -LiteralPath $storePath -Recurse -Force -ErrorAction Stop',
  ].join('\n');
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, MINERADIO_WINDOWS_CERT_STORE: storeName },
    stdio: 'inherit',
    windowsHide: true,
  });
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
  const importCertificate = options.importCertificate || importWindowsCertificate;
  const removeCertificateStore = options.removeCertificateStore || removeWindowsCertificateStore;
  const imported = importCertificate(config, run);
  try {
    if (imported.signingThumbprint !== config.expectedThumbprint) {
      throw new Error('Imported Windows signing certificate does not match WINDOWS_CERTIFICATE_SHA1.');
    }
    run(signTool, [
      'sign',
      '/fd', 'SHA256',
      '/tr', config.timestampUrl,
      '/td', 'SHA256',
      '/s', imported.storeName,
      '/sha1', config.expectedThumbprint,
      filePath,
    ], { stdio: 'inherit', windowsHide: true });
    run(signTool, ['verify', '/pa', '/all', filePath], { stdio: 'inherit', windowsHide: true });
  } finally {
    removeCertificateStore(imported.storeName, run);
  }
  return { ok: true, unsigned: false, filePath };
}

module.exports = {
  DEFAULT_TIMESTAMP_URL,
  importWindowsCertificate,
  normalizeThumbprint,
  readWindowsSigningConfig,
  removeWindowsCertificateStore,
  resolveSignTool,
  signWindowsFile,
};
