/**
 * Tests for FB-E6: Docker Secrets (_FILE suffix support)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSecret } from '../src/secrets.js';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('resolveSecret', () => {
  const envBackup: Record<string, string | undefined> = {};
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'formbridge-secrets-'));
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    Object.keys(envBackup).forEach(k => delete envBackup[k]);
  });

  function setEnv(key: string, value: string | undefined) {
    envBackup[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  it('returns plain env var when no _FILE is set', () => {
    setEnv('TEST_SECRET', 'my-value');
    setEnv('TEST_SECRET_FILE', undefined);
    expect(resolveSecret('TEST_SECRET')).toBe('my-value');
  });

  it('returns undefined when neither is set', () => {
    setEnv('TEST_SECRET', undefined);
    setEnv('TEST_SECRET_FILE', undefined);
    expect(resolveSecret('TEST_SECRET')).toBeUndefined();
  });

  it('reads file contents when _FILE is set', () => {
    const filePath = join(tempDir, 'secret.txt');
    writeFileSync(filePath, 'file-secret-value\n');
    setEnv('TEST_SECRET_FILE', filePath);
    setEnv('TEST_SECRET', undefined);
    expect(resolveSecret('TEST_SECRET')).toBe('file-secret-value');
  });

  it('trims whitespace from file contents', () => {
    const filePath = join(tempDir, 'secret-whitespace.txt');
    writeFileSync(filePath, '  trimmed-value  \n\n');
    setEnv('TEST_SECRET_FILE', filePath);
    expect(resolveSecret('TEST_SECRET')).toBe('trimmed-value');
  });

  it('_FILE takes precedence over plain env var', () => {
    const filePath = join(tempDir, 'secret-precedence.txt');
    writeFileSync(filePath, 'from-file');
    setEnv('TEST_SECRET_FILE', filePath);
    setEnv('TEST_SECRET', 'from-env');
    expect(resolveSecret('TEST_SECRET')).toBe('from-file');
  });

  it('throws on missing file', () => {
    setEnv('TEST_SECRET_FILE', '/nonexistent/path/secret.txt');
    expect(() => resolveSecret('TEST_SECRET')).toThrow(
      /Failed to read secret file for TEST_SECRET_FILE/
    );
  });

  it('throws with clear error message on permission denied', () => {
    // This test may behave differently on different OS/permissions
    setEnv('TEST_SECRET_FILE', '/root/no-access');
    expect(() => resolveSecret('TEST_SECRET')).toThrow(
      /Failed to read secret file/
    );
  });
});
