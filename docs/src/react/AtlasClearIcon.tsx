import AtlasIcon from './AtlasIcon';
import { useI18n } from './useI18n';

export default function AtlasClearIcon() {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t('Clear value')}>
      <AtlasIcon name="x" />
    </span>
  );
}
