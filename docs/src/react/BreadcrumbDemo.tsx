import { useId, useState } from 'react';
import { Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasBreadcrumb, { type AtlasBreadcrumbItem } from './AtlasBreadcrumb';
import { TweakerSettings } from './AtlasTweaker';
import { useI18n } from './useI18n';

const workspacePages = [
  ['data-table', 'Data table'],
  ['collection-views', 'Collection views'],
  ['record-details', 'Record details'],
  ['record-forms', 'Record forms'],
  ['record-workspace', 'Record workspace'],
] as const;

function BreadcrumbExamples() {
  const { t } = useI18n();
  const iconsId = useId();
  const homeId = useId();
  // Presentation only; every link keeps its destination and the example owns these choices.
  const [showIcons, setShowIcons] = useState(true);
  const [iconOnlyHome, setIconOnlyHome] = useState(true);
  const quickItems: AtlasBreadcrumbItem[] = [
    { key: 'overview', label: t('Overview'), href: '/' },
    {
      key: 'workspace',
      label: t('Data workspace'),
      href: '/components/record-workspace/',
      menuLabel: t('Navigate Data workspace pages'),
      menu: workspacePages.map(([key, label]) => ({
        key,
        label: t(label),
        href: `/components/${key}/`,
      })),
    },
    { key: 'record-details', label: t('Record details') },
  ];
  const iconItems: AtlasBreadcrumbItem[] = [
    {
      key: 'overview',
      label: t('Overview'),
      href: '/',
      icon: showIcons ? 'house' : undefined,
      iconOnly: showIcons && iconOnlyHome,
    },
    {
      key: 'record-workspace',
      label: t('Record workspace'),
      href: '/components/record-workspace/',
      icon: showIcons ? 'settings' : undefined,
    },
    { key: 'record-details', label: t('Record details'), icon: showIcons ? 'check' : undefined },
  ];
  return (
    <div className="breadcrumb-catalog" data-breadcrumb-catalog>
      <nav className="breadcrumb-navigation" aria-label={t('Breadcrumb examples')}>
        <a href="#breadcrumb-quick">{t('Quick navigation')}</a>
        <a href="#breadcrumb-icons">{t('Icon style')}</a>
      </nav>
      <section
        id="breadcrumb-quick"
        className="breadcrumb-section"
        aria-labelledby="breadcrumb-quick-title"
      >
        <header>
          <p className="eyebrow">{t('01 · Move in context')}</p>
          <h3 id="breadcrumb-quick-title">{t('Quick navigation')}</h3>
          <p>
            {t(
              'Follow the path back, or open the adjacent menu to move directly to a related workspace page.',
            )}
          </p>
        </header>
        <div className="breadcrumb-stage">
          <AtlasBreadcrumb label={t('Quick navigation path')} items={quickItems} />
        </div>
        <p className="breadcrumb-guidance">
          {t(
            'The page name marks your current location. The separate menu button opens all five workspace pages with click, Enter, Space or ArrowDown; Escape returns focus.',
          )}
        </p>
      </section>
      <section
        id="breadcrumb-icons"
        className="breadcrumb-section"
        aria-labelledby="breadcrumb-icons-title"
      >
        <header>
          <p className="eyebrow">{t('02 · Recognize the path')}</p>
          <h3 id="breadcrumb-icons-title">{t('Icon style')}</h3>
          <p>
            {t(
              'A familiar home shortcut saves space. Meaningful icons accompany readable page names, while the current page stays distinct.',
            )}
          </p>
        </header>
        <div className="breadcrumb-stage">
          <AtlasBreadcrumb label={t('Icon navigation path')} items={iconItems} />
        </div>
        <p className="breadcrumb-guidance">
          {t(
            'Paths wrap naturally on narrow screens. Icons are decorative; the home link keeps its accessible name and every ancestor leads to a real documentation page.',
          )}
        </p>
      </section>
      <TweakerSettings title="Breadcrumb">
        <div className="atlas-tweaker-token">
          <label htmlFor={iconsId}>{t('Show icons')}</label>
          <Switch id={iconsId} checked={showIcons} onChange={checked => setShowIcons(checked)} />
        </div>
        <div className="atlas-tweaker-token">
          <label htmlFor={homeId}>{t('Icon-only home')}</label>
          <Switch
            id={homeId}
            checked={showIcons && iconOnlyHome}
            disabled={!showIcons}
            onChange={checked => setIconOnlyHome(checked)}
          />
        </div>
      </TweakerSettings>
    </div>
  );
}

export default function BreadcrumbDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <BreadcrumbExamples />
    </AtlasProvider>
  );
}
