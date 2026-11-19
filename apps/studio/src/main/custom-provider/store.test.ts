import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { cleanupTempFixtures, makeStateRoot } from '@studio/fixtures';
import { activeCustomProvider, customProviderState, removeCustomProvider, resetCustomProviderCacheForTests, saveCustomProvider, type KeyCipher } from './store.js';
import { codexProviderConfig, codexProviderEnv, CODEX_CUSTOM_PROVIDER_KEY_ENV } from './codex.js';

const savedRoot = process.env['STUDIO_STATE_ROOT'];
let root = '';

const sealing: KeyCipher = {
  canEncrypt: () => true,
  encrypt: (plain) => `sealed:${Buffer.from(plain).toString('base64')}`,
  decrypt: (sealed) => Buffer.from(sealed.replace(/^sealed:/, ''), 'base64').toString(),
};
const keyless: KeyCipher = { canEncrypt: () => false, encrypt: () => { throw new Error('no keychain'); }, decrypt: () => { throw new Error('no keychain'); } };

beforeEach(() => {
  root = makeStateRoot({ name: 'custom-provider' });
  process.env['STUDIO_STATE_ROOT'] = root;
  resetCustomProviderCacheForTests();
});

afterAll(() => {
  if (savedRoot === undefined) delete process.env['STUDIO_STATE_ROOT'];
  else process.env['STUDIO_STATE_ROOT'] = savedRoot;
  resetCustomProviderCacheForTests();
  cleanupTempFixtures();
});

const fileText = (): string => readFileSync(join(root, 'custom-provider.json'), 'utf8');

describe('custom provider store', () => {
  it('never writes the key in the clear when the OS can encrypt it', () => {
    const result = saveCustomProvider({ baseUrl: 'http://gateway.test:20128/v1/', models: ['deepseek-agent', ' deepseek-agent '], apiKey: 'sk-secret' }, sealing);
    expect(result).toMatchObject({ ok: true, state: { baseUrl: 'http://gateway.test:20128/v1', models: ['deepseek-agent'], hasKey: true, keyStorage: 'encrypted' } });
    expect(fileText()).not.toContain('sk-secret');
    expect(activeCustomProvider(sealing)).toEqual({ baseUrl: 'http://gateway.test:20128/v1', models: ['deepseek-agent'], apiKey: 'sk-secret' });
  });

  it('refuses a plaintext key without consent, and writes nothing', () => {
    const refused = saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['m'], apiKey: 'sk-secret' }, keyless);
    expect(refused).toMatchObject({ ok: false, reason: 'needs-plaintext-consent' });
    expect(activeCustomProvider(keyless)).toBeUndefined();

    const allowed = saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['m'], apiKey: 'sk-secret', allowPlaintext: true }, keyless);
    expect(allowed).toMatchObject({ ok: true, state: { keyStorage: 'plaintext' } });
    expect(activeCustomProvider(keyless)?.apiKey).toBe('sk-secret');
  });

  it('keeps the stored key when a save leaves it out', () => {
    saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['a'], apiKey: 'sk-secret' }, sealing);
    saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['a', 'b'] }, sealing);
    expect(activeCustomProvider(sealing)).toEqual({ baseUrl: 'http://gateway.test/v1', models: ['a', 'b'], apiKey: 'sk-secret' });
  });

  it('rejects a URL that is not http(s) and an empty model list', () => {
    expect(saveCustomProvider({ baseUrl: 'file:///etc/passwd', models: ['a'] }, sealing)).toMatchObject({ ok: false, reason: 'invalid-url' });
    expect(saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['  '] }, sealing)).toMatchObject({ ok: false, reason: 'no-models' });
    expect(customProviderState(sealing).baseUrl).toBeUndefined();
  });

  it('disables the provider when the saved key no longer decrypts', () => {
    saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['a'], apiKey: 'sk-secret' }, sealing);
    expect(activeCustomProvider(keyless)).toBeUndefined();
  });

  it('forgets everything on remove', () => {
    saveCustomProvider({ baseUrl: 'http://gateway.test/v1', models: ['a'], apiKey: 'sk-secret' }, sealing);
    expect(removeCustomProvider(sealing)).toEqual({ models: [], hasKey: false, canEncrypt: true });
    expect(activeCustomProvider(sealing)).toBeUndefined();
  });
});

describe('codex provider wiring', () => {
  it('puts the key only in the env, never in the config codex receives as argv', () => {
    const provider = { baseUrl: 'http://gateway.test/v1', models: ['a'], apiKey: 'sk-secret' };
    const config = codexProviderConfig(provider);
    expect(Object.values(config).join(' ')).not.toContain('sk-secret');
    expect(config['model_providers.onlook_custom.wire_api']).toBe('"responses"');
    expect(codexProviderEnv(provider, {})[CODEX_CUSTOM_PROVIDER_KEY_ENV]).toBe('sk-secret');
  });
});
