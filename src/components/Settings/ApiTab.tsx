import { useState } from 'react';
import type { AppSettings } from '../../persistence/settings-store.ts';
import styles from './Settings.module.css';

interface ApiTabProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

function getKeyStatus(key: string): 'not-set' | 'valid' | 'invalid' {
  if (!key) return 'not-set';
  if (key.startsWith('AI') && key.length > 20) return 'valid';
  return 'invalid';
}

export function ApiTab({ settings, onUpdate }: ApiTabProps) {
  const [showKey, setShowKey] = useState(false);
  const status = getKeyStatus(settings.geminiApiKey);

  const statusLabel =
    status === 'not-set' ? 'Not set' :
    status === 'valid' ? 'Valid format' :
    'Invalid format';

  const statusClass =
    status === 'not-set' ? styles.statusNotSet :
    status === 'valid' ? styles.statusValid :
    styles.statusInvalid;

  return (
    <div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Gemini API Key</legend>
        <div className={styles.inputGroup}>
          <input
            className={styles.textInput}
            type={showKey ? 'text' : 'password'}
            value={settings.geminiApiKey}
            onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
            placeholder="AIza..."
            aria-label="Gemini API key"
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${styles.statusIndicator} ${statusClass}`} data-testid="key-status">
          {statusLabel}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <button
          type="button"
          className={styles.testButton}
          disabled={status !== 'valid'}
          onClick={() => {
            /* placeholder — validates format only */
          }}
        >
          Test Connection
        </button>
      </fieldset>
    </div>
  );
}
