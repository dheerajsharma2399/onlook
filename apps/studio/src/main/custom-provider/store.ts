import { safeStorage } from 'electron';
import {
  isProviderUrl,
  type CustomProviderKeyStorage,
  type CustomProviderState,
  type SaveCustomProviderRequest,
  type SaveCustomProviderResult,
} from '@studio/events';
import { isLinux } from '../env/platform.js';
import { defineDomain } from '../state/store.js';

interface StoredKey {
  storage: CustomProviderKeyStorage;
  value: string;
}

interface StoredProvider {
  baseUrl?: string;
  models?: string[];
  key?: StoredKey;
}

export interface KeyCipher {
  canEncrypt(): boolean;
  encrypt(plain: string): string;
  decrypt(sealed: string): string;
}

/** `basic_text` is Chromium's hardcoded-password fallback, so it counts as no encryption. */
const electronCipher: KeyCipher = {
  canEncrypt: () => safeStorage.isEncryptionAvailable() && (!isLinux() || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (sealed) => safeStorage.decryptString(Buffer.from(sealed, 'base64')),
};

const domain = defineDomain<StoredProvider>({
  name: 'custom-provider',
  version: 1,
  fallback: () => ({}),
});

export interface ActiveCustomProvider {
  baseUrl: string;
  models: string[];
  apiKey?: string;
}

function stored(): StoredProvider {
  const value = domain.read() as StoredProvider | null;
  return value ?? {};
}

function usableModels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((model): model is string => typeof model === 'string' && model.trim() !== '') : [];
}

export function customProviderState(cipher: KeyCipher = electronCipher): CustomProviderState {
  const current = stored();
  return {
    ...(typeof current.baseUrl === 'string' ? { baseUrl: current.baseUrl } : {}),
    models: usableModels(current.models),
    hasKey: current.key !== undefined,
    ...(current.key === undefined ? {} : { keyStorage: current.key.storage }),
    canEncrypt: cipher.canEncrypt(),
  };
}

/** Undefined unless a URL and at least one model are saved; a key that no longer decrypts disables the provider. */
export function activeCustomProvider(cipher: KeyCipher = electronCipher): ActiveCustomProvider | undefined {
  const current = stored();
  const models = usableModels(current.models);
  if (typeof current.baseUrl !== 'string' || !isProviderUrl(current.baseUrl) || models.length === 0) return undefined;
  const key = current.key;
  if (key === undefined) return { baseUrl: current.baseUrl, models };
  try {
    const apiKey = key.storage === 'encrypted' ? cipher.decrypt(key.value) : key.value;
    return { baseUrl: current.baseUrl, models, apiKey };
  } catch {
    return undefined;
  }
}

export function saveCustomProvider(request: SaveCustomProviderRequest, cipher: KeyCipher = electronCipher): SaveCustomProviderResult {
  const baseUrl = typeof request?.baseUrl === 'string' ? request.baseUrl.trim().replace(/\/+$/, '') : '';
  const models = [...new Set(usableModels(request?.models).map((model) => model.trim()))];
  if (!isProviderUrl(baseUrl)) return { ok: false, reason: 'invalid-url', state: customProviderState(cipher) };
  if (models.length === 0) return { ok: false, reason: 'no-models', state: customProviderState(cipher) };

  let key = stored().key;
  if (typeof request.apiKey === 'string') {
    const apiKey = request.apiKey.trim();
    if (apiKey === '') key = undefined;
    else if (cipher.canEncrypt()) key = { storage: 'encrypted', value: cipher.encrypt(apiKey) };
    else if (request.allowPlaintext === true) key = { storage: 'plaintext', value: apiKey };
    else return { ok: false, reason: 'needs-plaintext-consent', state: customProviderState(cipher) };
  }
  domain.write({ baseUrl, models, ...(key === undefined ? {} : { key }) });
  return { ok: true, state: customProviderState(cipher) };
}

export function removeCustomProvider(cipher: KeyCipher = electronCipher): CustomProviderState {
  domain.erase();
  return customProviderState(cipher);
}

export function resetCustomProviderCacheForTests(): void {
  domain.reset();
}
