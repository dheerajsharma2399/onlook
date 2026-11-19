import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { isProviderUrl, parseModelList, type CustomProviderState, type SaveCustomProviderRequest, type SaveCustomProviderResult } from '@studio/events';
import { t, type StringKey } from '@studio/i18n';
import { SETTINGS_CONTENT_WIDTH } from './SettingsPane.js';
import { PANE_LEADING, SettingsSection } from './rows.js';
import { useSettingsStore } from './store.js';

const PROVIDER_TESTIDS = {
  pane: 'settings-provider-pane',
  baseUrl: 'settings-provider-base-url',
  apiKey: 'settings-provider-api-key',
  models: 'settings-provider-models',
  plaintext: 'settings-provider-plaintext',
  save: 'settings-provider-save',
  remove: 'settings-provider-remove',
  outcome: 'settings-provider-outcome',
} as const;

type Outcome = 'idle' | 'saving' | 'saved' | 'failed' | SaveFailure;
type SaveFailure = Extract<SaveCustomProviderResult, { ok: false }>['reason'];

const OUTCOME_TEXT: Partial<Record<Outcome, StringKey>> = {
  saved: 'settings.provider.saved',
  failed: 'settings.provider.saveFailed',
  'invalid-url': 'settings.provider.baseUrl.invalid',
  'no-models': 'settings.provider.models.empty',
  'needs-plaintext-consent': 'settings.provider.plaintext.required',
};

const FIELDS = { padding: 'var(--spacing-5)' } as const;

export interface ProviderPaneViewProps {
  state: CustomProviderState;
  onSave: (request: SaveCustomProviderRequest) => Promise<SaveCustomProviderResult>;
  onRemove: () => Promise<void>;
}

export function ProviderPane(): React.JSX.Element {
  const state = useSettingsStore((s) => s.customProvider);
  const onSave = useSettingsStore((s) => s.saveCustomProvider);
  const onRemove = useSettingsStore((s) => s.removeCustomProvider);
  return <ProviderPaneView state={state} onSave={onSave} onRemove={onRemove} />;
}

export function ProviderPaneView({ state, onSave, onRemove }: ProviderPaneViewProps): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(state.baseUrl ?? '');
  const [models, setModels] = useState(state.models.join('\n'));
  const [apiKey, setApiKey] = useState('');
  const [allowPlaintext, setAllowPlaintext] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const isBusy = outcome === 'saving';
  const isConfigured = state.baseUrl !== undefined;
  const urlInvalid = baseUrl.trim() !== '' && !isProviderUrl(baseUrl);
  const offersPlaintext = !state.canEncrypt && apiKey.trim() !== '';

  const save = (): void => {
    setOutcome('saving');
    onSave({
      baseUrl,
      models: parseModelList(models),
      ...(apiKey.trim() === '' ? {} : { apiKey }),
      ...(offersPlaintext ? { allowPlaintext } : {}),
    }).then((result) => {
      setOutcome(result.ok ? 'saved' : result.reason);
      if (result.ok) setApiKey('');
    }, () => setOutcome('failed'));
  };

  const remove = (): void => {
    setOutcome('saving');
    onRemove().then(() => {
      setBaseUrl('');
      setModels('');
      setApiKey('');
      setOutcome('idle');
    }, () => setOutcome('failed'));
  };

  const keyNote: StringKey | undefined = state.keyStorage === 'encrypted' ? 'settings.provider.apiKey.encrypted'
    : state.keyStorage === 'plaintext' ? 'settings.provider.apiKey.plaintext' : undefined;
  const outcomeText = OUTCOME_TEXT[outcome];

  return (
    <VStack className="settings-pane" gap={8} style={{ width: '100%', maxWidth: SETTINGS_CONTENT_WIDTH, ...PANE_LEADING }} data-testid={PROVIDER_TESTIDS.pane} data-configured={String(isConfigured)}>
      <SettingsSection label={t('settings.provider')} description={t('settings.provider.description')}>
        <VStack gap={5} style={FIELDS}>
          <TextInput
            label={t('settings.provider.baseUrl')}
            description={t('settings.provider.baseUrl.description')}
            value={baseUrl}
            onChange={setBaseUrl}
            isDisabled={isBusy}
            {...(urlInvalid ? { status: { type: 'error', message: t('settings.provider.baseUrl.invalid') } } : {})}
            data-testid={PROVIDER_TESTIDS.baseUrl}
          />
          <TextInput
            label={t('settings.provider.apiKey')}
            description={t(state.hasKey ? 'settings.provider.apiKey.saved' : 'settings.provider.apiKey.description')}
            type="password"
            value={apiKey}
            onChange={setApiKey}
            isDisabled={isBusy}
            data-testid={PROVIDER_TESTIDS.apiKey}
          />
          {keyNote !== undefined && <Text type="supporting">{t(keyNote)}</Text>}
          {offersPlaintext && (
            <Card padding={4}>
              <HStack gap={4} vAlign="center" justify="between">
                <VStack gap={0.5} style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <Text type="body">{t('settings.provider.plaintext.label')}</Text>
                  <Text type="supporting">{t('settings.provider.plaintext.description')}</Text>
                </VStack>
                <Switch
                  label={t('settings.provider.plaintext.label')}
                  isLabelHidden
                  value={allowPlaintext}
                  onChange={setAllowPlaintext}
                  isDisabled={isBusy}
                  data-testid={PROVIDER_TESTIDS.plaintext}
                />
              </HStack>
            </Card>
          )}
          <TextArea
            label={t('settings.provider.models')}
            description={t('settings.provider.models.description')}
            value={models}
            onChange={setModels}
            rows={4}
            isDisabled={isBusy}
            data-testid={PROVIDER_TESTIDS.models}
          />
          <HStack gap={3} vAlign="center" style={{ flexWrap: 'wrap' }}>
            <Button
              label={t('settings.provider.save')}
              variant="primary"
              onClick={save}
              isLoading={isBusy}
              isDisabled={isBusy || urlInvalid || baseUrl.trim() === '' || parseModelList(models).length === 0}
              data-testid={PROVIDER_TESTIDS.save}
            />
            {isConfigured && (
              <Button label={t('settings.provider.remove')} variant="ghost" onClick={remove} isDisabled={isBusy} data-testid={PROVIDER_TESTIDS.remove} />
            )}
          </HStack>
          {outcomeText !== undefined && (
            <Text
              type="supporting"
              role={outcome === 'saved' ? 'status' : 'alert'}
              style={outcome === 'saved' ? undefined : { color: 'var(--color-error)' }}
              data-testid={PROVIDER_TESTIDS.outcome}
              data-outcome={outcome}
            >
              {t(outcomeText)}
            </Text>
          )}
        </VStack>
      </SettingsSection>
    </VStack>
  );
}
