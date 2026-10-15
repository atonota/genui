import { useState } from 'react';
import AtlasProvider from './AtlasProvider';
import AtlasListy, { type AtlasListyEntry, type AtlasListyPresentation } from './AtlasListy';
import AtlasIcon from './AtlasIcon';
import Segmented from './AtlasSegmented';
import { TweakerSettings } from './AtlasTweaker';
import { useI18n } from './useI18n';
import '../styles/atlas-listy.css';

function ListyExamples() {
  const { t } = useI18n();
  const [presentation, setPresentation] = useState<AtlasListyPresentation>('inset');
  const pages: AtlasListyEntry[] = [
    {
      key: 'button',
      label: t('Button'),
      description: t('Choose an action and its emphasis.'),
      leading: <AtlasIcon name="check" />,
      trailing: t('Actions'),
    },
    {
      key: 'cascader',
      label: t('Cascader'),
      description: t('Choose a destination through a clear hierarchy.'),
      leading: <AtlasIcon name="search" />,
      trailing: t('Data entry'),
    },
    {
      key: 'tweaker',
      label: t('Tweaker'),
      description: t('Adjust the example without losing your draft.'),
      leading: <AtlasIcon name="settings" />,
      trailing: t('Documentation'),
    },
    {
      key: 'archive',
      label: t('Archived pages'),
      description: t('Unavailable in this local example.'),
      leading: <AtlasIcon name="house" />,
      disabled: true,
    },
  ];
  return (
    <div className="atlas-listy-demo">
      <TweakerSettings title="Listy presentation">
        <Segmented
          className="atlas-listy-presentation"
          aria-label={t('Listy presentation')}
          block
          value={presentation}
          onChange={value => setPresentation(value as AtlasListyPresentation)}
          options={[
            { value: 'inset', label: t('Inset') },
            { value: 'outlined', label: t('Outlined') },
          ]}
        />
      </TweakerSettings>
      <AtlasListy
        label={t('Documentation pages')}
        items={pages.map(({ key, label, disabled }) => ({ key, label, disabled }))}
        presentation={presentation}
      />
      <AtlasListy label={t('Documentation pages')} items={pages} presentation={presentation} />
    </div>
  );
}

/** Local Listy examples; size comes from the shared profile, presentation from this page. */
export default function ListyDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined} sizeFamily="pill">
      <ListyExamples />
    </AtlasProvider>
  );
}
