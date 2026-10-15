import { useId, useState } from 'react';
import { Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasRichMenu, { type AtlasRichMenuGroup } from './AtlasRichMenu';
import { TweakerSettings } from './AtlasTweaker';
import { useI18n } from './useI18n';

function RichMenuExample() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string>();
  const unavailableId = useId();
  // Presentation only: hidden items are left out of the menu, never enabled.
  const [showUnavailable, setShowUnavailable] = useState(true);
  const allGroups: AtlasRichMenuGroup[] = [
    {
      id: 'report-tools',
      label: t('Report tools'),
      items: [
        {
          id: 'draft-report',
          label: t('Draft report'),
          description: t('Create a report from the current workspace.'),
        },
        {
          id: 'publish-remotely',
          label: t('Publish remotely'),
          description: t('Remote publishing is not available in this example.'),
          disabled: true,
        },
      ],
    },
    {
      id: 'collection-tools',
      label: t('Collection tools'),
      items: [
        {
          id: 'new-collection',
          label: t('New collection'),
          description: t('Organize related records.'),
        },
      ],
    },
  ];
  const groups = allGroups.map(group => ({
    ...group,
    items: group.items.filter(item => showUnavailable || !item.disabled),
  }));
  const selectedLabel = groups
    .flatMap(group => group.items)
    .find(item => item.id === selected)?.label;
  return (
    <div className="atlas-rich-menu-demo">
      <TweakerSettings title="Rich menu settings">
        <div className="atlas-tweaker-option">
          <label htmlFor={unavailableId}>{t('Show unavailable actions')}</label>
          <Switch id={unavailableId} checked={showUnavailable} onChange={setShowUnavailable} />
        </div>
      </TweakerSettings>
      <AtlasRichMenu label={t('Workspace shortcuts')} groups={groups} onAction={setSelected} />
      <p className="atlas-rich-menu-status" role="status">
        {selectedLabel ? t('Selected: {label}', { label: selectedLabel }) : ''}
      </p>
    </div>
  );
}

/** Local-only grouped shortcuts; choosing an action updates nearby status text. */
export default function RichMenuDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <RichMenuExample />
    </AtlasProvider>
  );
}
