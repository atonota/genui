import { useId, useState } from 'react';
import { Switch, type DropdownProps, type MenuProps } from 'antd';
import AtlasProvider from './AtlasProvider';
import { TweakerSettings } from './AtlasTweaker';
import AtlasDropdown from './AtlasDropdown';
import AtlasIcon from './AtlasIcon';
import AtlasPill from './AtlasPill';
import { useI18n } from './useI18n';

const quietClassNames: DropdownProps['classNames'] = {
  root: 'atlas-dropdown-quiet',
  item: 'atlas-dropdown-quiet-item',
};
const quietStyles: DropdownProps['styles'] = {
  root: { borderRadius: 'var(--radius)' },
  item: { borderRadius: 'var(--radius-sm)' },
  itemTitle: { color: 'var(--ink)' },
};
const contextClassNames: DropdownProps['classNames'] = ({ props }) => ({
  root: `atlas-dropdown-context${props.open ? ' atlas-dropdown-context-open' : ''}`,
  itemContent: 'atlas-dropdown-context-content',
});
const contextStyles: DropdownProps['styles'] = ({ props }) => ({
  root: { boxShadow: props.open ? 'var(--shadow-soft)' : 'var(--shadow-contact)' },
  item: { borderRadius: 'var(--radius-sm)' },
  itemTitle: { color: 'var(--ink)' },
});

// Presentation only: every item keeps its key, label, handler and disabled state.
function withoutIcons(items: NonNullable<MenuProps['items']>): NonNullable<MenuProps['items']> {
  return items.map(item => {
    if (!item) return item;
    if ('children' in item) {
      if (item.type === 'group') return { ...item, children: withoutIcons(item.children ?? []) };
      return { ...item, icon: undefined, children: withoutIcons(item.children) };
    }
    return 'icon' in item ? { ...item, icon: undefined } : item;
  });
}

function DropdownExamples({ documentation = false }: { documentation?: boolean }) {
  const { t } = useI18n();
  const settingsId = useId();
  const [showIcons, setShowIcons] = useState(true);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState<number[]>([]);
  const [phase, setPhase] = useState<'draft' | 'review'>('draft');
  const [folder, setFolder] = useState<'inbox' | 'planning' | 'delivery'>('inbox');
  const [message, setMessage] = useState('Choose an action to see its local result.');
  const [messageCount, setMessageCount] = useState(0);
  const actions: NonNullable<MenuProps['items']> = [
    {
      key: 'save',
      label: t(saved ? 'Remove from local collection' : 'Save to local collection'),
      icon: <AtlasIcon name="check" />,
    },
    { key: 'note', label: t('Add review note'), icon: <AtlasIcon name="plus" /> },
    {
      key: 'publish',
      label: t('Publish remotely'),
      disabled: true,
      icon: <AtlasIcon name="arrowRight" />,
    },
    { type: 'divider' },
    {
      key: 'clear',
      label: t('Clear local notes'),
      danger: true,
      disabled: notes.length === 0,
      icon: <AtlasIcon name="trash" />,
    },
  ];
  const reviewActions: NonNullable<MenuProps['items']> = [
    {
      key: 'review',
      label: t('Mark ready for review'),
      icon: <AtlasIcon name="check" />,
      disabled: phase === 'review',
    },
    {
      key: 'draft',
      label: t('Return to draft'),
      icon: <AtlasIcon name="reload" />,
      disabled: phase === 'draft',
    },
    { type: 'divider' },
    { key: 'publish', label: t('Publish remotely'), disabled: true },
  ];
  const organization: NonNullable<MenuProps['items']> = [
    {
      type: 'group',
      key: 'workspace-group',
      label: t('Workspace'),
      children: [
        {
          key: 'move',
          label: t('Move to folder'),
          icon: <AtlasIcon name="arrowRight" />,
          children: [
            { key: 'planning', label: t('Planning') },
            { key: 'delivery', label: t('Delivery') },
          ],
        },
        {
          key: 'access',
          label: t('Access settings'),
          icon: <AtlasIcon name="lock-simple" />,
          disabled: true,
          children: [{ key: 'permissions', label: t('Manage access') }],
        },
      ],
    },
    { type: 'divider' },
    {
      key: 'inbox',
      label: t('Reset local organization'),
      danger: true,
      icon: <AtlasIcon name="reload" />,
    },
  ];
  const onAction = (key: string) => {
    if (key === 'save') {
      setSaved(value => !value);
      setMessage(saved ? 'Removed from your local collection.' : 'Saved to your local collection.');
    } else if (key === 'note') {
      const count = notes.length + 1;
      setNotes(current => [...current, (current.at(-1) ?? 0) + 1]);
      setMessageCount(count);
      setMessage('Review note added. {count} local notes.');
    } else if (key === 'clear') {
      setNotes([]);
      setMessage('Local notes cleared.');
    } else if (key === 'review' || key === 'draft') {
      setPhase(key);
      setMessage(
        key === 'review'
          ? 'Workspace marked ready for local review.'
          : 'Workspace returned to a local draft.',
      );
    } else if (key === 'planning' || key === 'delivery' || key === 'inbox') {
      setFolder(key);
      setMessage(
        key === 'planning'
          ? 'Workspace moved to Planning locally.'
          : key === 'delivery'
            ? 'Workspace moved to Delivery locally.'
            : 'Workspace returned to Inbox locally.',
      );
    }
  };
  const phaseLabel = t(phase === 'draft' ? 'Draft' : 'Ready for review');
  const folderLabel = t(
    folder === 'inbox' ? 'Inbox' : folder === 'planning' ? 'Planning' : 'Delivery',
  );
  const menu = (items: NonNullable<MenuProps['items']>) =>
    showIcons ? items : withoutIcons(items);
  const settings = documentation ? (
    <TweakerSettings title="Dropdown settings">
      <div className="atlas-tweaker-token">
        <label htmlFor={`${settingsId}icons`}>{t('Show menu icons')}</label>
        <Switch
          id={`${settingsId}icons`}
          checked={showIcons}
          onChange={checked => setShowIcons(checked)}
        />
      </div>
    </TweakerSettings>
  ) : null;
  return (
    <div className="dropdown-catalog" data-dropdown-catalog>
      {settings}
      <nav className="dropdown-navigation" aria-label={t('Dropdown examples')}>
        <a href="#dropdown-basic">{t('Basic actions')}</a>
        <a href="#dropdown-surfaces">{t('Surfaces')}</a>
        <a href="#dropdown-cascading">{t('Cascading menu')}</a>
      </nav>
      <div className="dropdown-local-context">
        <div>
          <p className="eyebrow">{t('Local workspace')}</p>
          <h3>Atlas Studio</h3>
        </div>
        <div className="dropdown-facts">
          <AtlasPill color={phase === 'draft' ? 'default' : 'success'}>{phaseLabel}</AtlasPill>
          <AtlasPill color="processing">{folderLabel}</AtlasPill>
          <span>{t(saved ? 'In your collection' : 'Not saved')}</span>
        </div>
        <p className="dropdown-status" role="status" aria-live="polite">
          {t(message, { count: messageCount })}
        </p>
      </div>
      <section
        id="dropdown-basic"
        className="dropdown-section"
        aria-labelledby="dropdown-basic-title"
      >
        <header>
          <p className="eyebrow">{t('01 · Act in place')}</p>
          <h3 id="dropdown-basic-title">{t('Basic actions')}</h3>
          <p>
            {t(
              'Keep related actions within reach. Save this workspace or add a local review note without leaving the page.',
            )}
          </p>
        </header>
        <div className="dropdown-stage">
          <AtlasDropdown label={t('Workspace actions')} items={menu(actions)} onAction={onAction} />
          <div className="dropdown-notes" aria-label={t('Local review notes')}>
            {notes.length ? (
              <ul>
                {notes.map(note => (
                  <li key={note}>{t('Review note {number}', { number: note })}</li>
                ))}
              </ul>
            ) : (
              <p>{t('No local notes yet.')}</p>
            )}
          </div>
        </div>
      </section>
      <section
        id="dropdown-surfaces"
        className="dropdown-section"
        aria-labelledby="dropdown-surfaces-title"
      >
        <header>
          <p className="eyebrow">{t('02 · Match the context')}</p>
          <h3 id="dropdown-surfaces-title">{t('Surfaces')}</h3>
          <p>
            {t(
              'Two quiet treatments share the same review actions. Their surfaces stay aligned with the current theme and workspace state.',
            )}
          </p>
        </header>
        <div className="dropdown-surface-grid">
          <div className="dropdown-stage">
            <h4>{t('Quiet tools')}</h4>
            <p>{t('A neutral menu for everyday work.')}</p>
            <AtlasDropdown
              label={t('Review tools')}
              items={menu(reviewActions)}
              onAction={onAction}
              classNames={quietClassNames}
              styles={quietStyles}
            />
          </div>
          <div className="dropdown-stage">
            <h4>{t('Contextual actions')}</h4>
            <p>{t('A soft accent keeps this review menu connected to its workspace.')}</p>
            <AtlasDropdown
              label={t('Review options')}
              items={menu(reviewActions)}
              onAction={onAction}
              classNames={contextClassNames}
              styles={contextStyles}
            />
          </div>
        </div>
      </section>
      <section
        id="dropdown-cascading"
        className="dropdown-section"
        aria-labelledby="dropdown-cascading-title"
      >
        <header>
          <p className="eyebrow">{t('03 · Organize clearly')}</p>
          <h3 id="dropdown-cascading-title">{t('Cascading menu')}</h3>
          <p>
            {t(
              'Group related choices and reveal the next level deliberately. Move the workspace into a folder; unavailable access settings remain clear and inactive.',
            )}
          </p>
        </header>
        <div className="dropdown-stage">
          <AtlasDropdown
            label={t('Organize workspace')}
            items={menu(organization)}
            onAction={onAction}
          />
          <p className="dropdown-guidance">
            {t(
              'Open by click, Enter, Space or ArrowDown. Use arrow keys between choices and submenu levels. Escape closes the menu and returns focus.',
            )}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function DropdownDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <DropdownExamples documentation={documentation} />
    </AtlasProvider>
  );
}
