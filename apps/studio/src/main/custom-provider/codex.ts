import type { ActiveCustomProvider } from './store.js';

export const CODEX_CUSTOM_PROVIDER_ID = 'onlook_custom';
/** The key travels only in the child's env, never in `--config` argv. */
export const CODEX_CUSTOM_PROVIDER_KEY_ENV = 'ONLOOK_CUSTOM_PROVIDER_API_KEY';

/** Codex 0.167 refuses `wire_api = "chat"`, so the endpoint must speak the Responses API. */
export function codexProviderConfig(provider: ActiveCustomProvider): Record<string, string> {
  const prefix = `model_providers.${CODEX_CUSTOM_PROVIDER_ID}`;
  return {
    model_provider: JSON.stringify(CODEX_CUSTOM_PROVIDER_ID),
    [`${prefix}.name`]: JSON.stringify('Custom provider'),
    [`${prefix}.base_url`]: JSON.stringify(provider.baseUrl),
    [`${prefix}.wire_api`]: '"responses"',
    ...(provider.apiKey === undefined ? {} : { [`${prefix}.env_key`]: JSON.stringify(CODEX_CUSTOM_PROVIDER_KEY_ENV) }),
  };
}

export function codexProviderEnv(provider: ActiveCustomProvider, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return provider.apiKey === undefined ? env : { ...env, [CODEX_CUSTOM_PROVIDER_KEY_ENV]: provider.apiKey };
}
