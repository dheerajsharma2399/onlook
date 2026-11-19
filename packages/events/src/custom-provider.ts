/** OpenAI Responses-compatible endpoint that the Codex Harness talks to instead of ChatGPT. */
export interface CustomProviderState {
  baseUrl?: string;
  models: string[];
  hasKey: boolean;
  keyStorage?: CustomProviderKeyStorage;
  /** The OS can encrypt a new key; false on Linux without a keyring. */
  canEncrypt: boolean;
}

export type CustomProviderKeyStorage = 'encrypted' | 'plaintext';

export interface SaveCustomProviderRequest {
  baseUrl: string;
  models: string[];
  /** Absent keeps the stored key; an empty string removes it. */
  apiKey?: string;
  /** Required to store a key when `canEncrypt` is false. */
  allowPlaintext?: boolean;
}

export type SaveCustomProviderResult =
  | { ok: true; state: CustomProviderState }
  | { ok: false; reason: 'invalid-url' | 'no-models' | 'needs-plaintext-consent'; state: CustomProviderState };

export const CODEX_CUSTOM_PROVIDER_PLAN = 'custom-provider';

export function parseModelList(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\n,]/)) {
    const model = part.trim();
    if (model !== '') seen.add(model);
  }
  return [...seen];
}

export function isProviderUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}
