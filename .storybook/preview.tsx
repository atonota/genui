import type { Preview } from '@storybook/react-vite';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  themeStyleText,
} from '../docs/src/theme';
import '../docs/src/styles/docs.css';
import '../docs/src/styles/atlas-shadows.css';
import '../docs/src/styles/components.css';
import './preview.css';
import '../docs/src/styles/web.css';
import '../docs/src/styles/atlas-input.css';
import { restoreLocale, setLocale, type Locale } from '../docs/src/i18n';
import { useI18n } from '../docs/src/react/useI18n';

function StoryFrame({
  children,
  sharedControls = false,
}: {
  children: ReactNode;
  sharedControls?: boolean;
}) {
  const { locale, t } = useI18n();
  const [localeError, setLocaleError] = useState(false);
  const localeRequest = useRef(0);
  useEffect(() => {
    const request = ++localeRequest.current;
    void restoreLocale().catch(() => {
      if (request === localeRequest.current) setLocaleError(true);
    });
    return () => {
      localeRequest.current++;
    };
  }, []);
  const changeLocale = async (next: Locale) => {
    const request = ++localeRequest.current;
    setLocaleError(false);
    try {
      await setLocale(next);
    } catch {
      if (request === localeRequest.current) setLocaleError(true);
    }
  };
  const mode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const dark = mode === 'dark';
  return (
    <main className="atlas-story-frame" aria-label={t('Component example')}>
      <style>{themeStyleText}</style>
      <div className="atlas-story-toolbar">
        <button
          className="atlas-story-theme"
          type="button"
          role="switch"
          aria-label={t('Dark theme')}
          aria-checked={dark}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {t('Theme')}: {dark ? t('Dark') : t('Light')}
        </button>
        <div className="locale-controls" role="group" aria-label={t('Language')}>
          <button
            className="locale-option"
            type="button"
            lang="en"
            aria-pressed={locale === 'en'}
            onClick={() => void changeLocale('en')}
          >
            English
          </button>
          <button
            className="locale-option"
            type="button"
            lang="tr"
            aria-pressed={locale === 'tr'}
            onClick={() => void changeLocale('tr')}
          >
            Türkçe
          </button>
        </div>
        {localeError && <p role="status">{t('Could not load this language.')}</p>}
      </div>
      {sharedControls ? <div className="live-preview">{children}</div> : children}
    </main>
  );
}

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    options: { storySort: { method: 'alphabetical' } },
  },
  decorators: [
    (Story, context) => (
      <StoryFrame sharedControls={context.parameters.atlasSharedPreview === true}>
        <Story />
      </StoryFrame>
    ),
  ],
};

export default preview;
