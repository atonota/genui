import type { ReactNode } from 'react';
import AtlasButton from '../AtlasButton';
import { TweakerSettings } from '../AtlasTweaker';
import { useI18n } from '../useI18n';

export type WorkspaceProfile = 'mobile' | 'desktop';
export default function WorkspaceFrame({
  profile,
  onProfileChange,
  title,
  kind,
  children,
}: {
  profile: WorkspaceProfile;
  onProfileChange: (profile: WorkspaceProfile) => void;
  title: string;
  kind: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="workspace-lab" data-profile={profile} data-workspace={kind}>
      <TweakerSettings title="Example layout">
        <div className="control-row" role="group" aria-label={t('Example layout')}>
          {(['mobile', 'desktop'] as const).map(value => (
            <AtlasButton
              key={value}
              id={`${kind}-${value}`}
              fill={profile === value ? 'solid' : 'ghost'}
              aria-pressed={profile === value}
              text={t(value === 'mobile' ? 'Mobile example' : 'Desktop example')}
              onClick={() => onProfileChange(value)}
            />
          ))}
        </div>
      </TweakerSettings>
      <h3>{t(title)}</h3>
      <p className="workspace-caption">
        {t(
          'Experimental examples awaiting approval. Fictional records; changes stay in this page and are not saved to a server.',
        )}
      </p>
      <div className="workspace-stage">{children}</div>
    </div>
  );
}
