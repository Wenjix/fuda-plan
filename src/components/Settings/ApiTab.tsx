import { useState } from 'react';
import type { AppSettings } from '../../persistence/settings-store.ts';
import styles from './Settings.module.css';

function getGeminiKeyStatus(key: string): 'not-set' | 'valid' | 'invalid' {
  if (!key) return 'not-set';
  if (key.startsWith('AI') && key.length > 20) return 'valid';
  return 'invalid';
}

function getElevenLabsKeyStatus(key: string): 'not-set' | 'valid' | 'invalid' {
  if (!key) return 'not-set';
  if (/^[a-f0-9]{32}$/i.test(key)) return 'valid';
  if (key.length >= 20) return 'valid'; // Some keys differ in format
  return 'invalid';
}

const STATUS_LABELS = {
  'not-set': 'Not set',
  valid: 'Valid format',
  invalid: 'Invalid format',
} as const;

function statusClass(status: 'not-set' | 'valid' | 'invalid') {
  return status === 'not-set'
    ? styles.statusNotSet
    : status === 'valid'
      ? styles.statusValid
      : styles.statusInvalid;
}

export function ApiTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (partial: Partial<AppSettings>) => void }) {
  const [showGemini, setShowGemini] = useState(false);
  const [showElevenLabs, setShowElevenLabs] = useState(false);

  const geminiStatus = getGeminiKeyStatus(settings.geminiApiKey);
  const elevenLabsStatus = getElevenLabsKeyStatus(settings.elevenLabsApiKey);

  return (
    <div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Gemini API Key</legend>
        <div className={styles.inputGroup}>
          <input
            className={styles.textInput}
            type={showGemini ? 'text' : 'password'}
            value={settings.geminiApiKey}
            onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
            placeholder="AIza..."
            aria-label="Gemini API key"
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowGemini((v) => !v)}
            aria-label={showGemini ? 'Hide API key' : 'Show API key'}
          >
            {showGemini ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${styles.statusIndicator} ${statusClass(geminiStatus)}`} data-testid="gemini-key-status">
          {STATUS_LABELS[geminiStatus]}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>ElevenLabs API Key</legend>
        <div className={styles.inputGroup}>
          <input
            className={styles.textInput}
            type={showElevenLabs ? 'text' : 'password'}
            value={settings.elevenLabsApiKey}
            onChange={(e) => onUpdate({ elevenLabsApiKey: e.target.value })}
            placeholder="Enter ElevenLabs API key"
            aria-label="ElevenLabs API key"
          />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setShowElevenLabs((v) => !v)}
            aria-label={showElevenLabs ? 'Hide API key' : 'Show API key'}
          >
            {showElevenLabs ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`${styles.statusIndicator} ${statusClass(elevenLabsStatus)}`} data-testid="elevenlabs-key-status">
          {STATUS_LABELS[elevenLabsStatus]}
        </div>
        <p className={styles.statusIndicator} style={{ color: 'var(--text-muted, #999)' }}>
          Voice transcription audio is sent to ElevenLabs when enabled.
        </p>
      </fieldset>
    </div>
  );
}
