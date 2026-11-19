import { IPC_INVOKE, type CustomProviderState, type SaveCustomProviderRequest, type SaveCustomProviderResult } from '@studio/events';
import { noteCodexProviderChanged } from '../agent-host/index.js';
import { rememberCatalog } from '../agent-host/preferences.js';
import { revalidateCodex } from '../codex/index.js';
import { handle } from '../ipc/bridge.js';
import { broadcastSettingsChanged } from '../settings/changed.js';
import { capture } from '../telemetry/index.js';
import { customProviderState, removeCustomProvider, saveCustomProvider } from './store.js';

function applied(state: CustomProviderState, action: 'saved' | 'removed'): void {
  rememberCatalog('appserver', state.models.map((value) => ({ value, displayName: value, supportsEffort: false, supportedEffortLevels: [] })));
  broadcastSettingsChanged();
  revalidateCodex();
  noteCodexProviderChanged();
  capture('custom_provider_changed', { action, model_count: state.models.length, key_storage: state.keyStorage ?? 'none' });
}

export function registerCustomProviderHandlers(): void {
  handle(IPC_INVOKE.customProviderState, (): CustomProviderState => customProviderState());

  handle(IPC_INVOKE.customProviderSave, (_event, request: SaveCustomProviderRequest): SaveCustomProviderResult => {
    const result = saveCustomProvider(request);
    if (result.ok) applied(result.state, 'saved');
    return result;
  });

  handle(IPC_INVOKE.customProviderRemove, (): CustomProviderState => {
    const state = removeCustomProvider();
    applied(state, 'removed');
    return state;
  });
}
