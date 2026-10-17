import GenUXIcon from './GenUXIcon';
import { useI18n } from './useI18n';

export default function GenUXClearIcon() {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t('Clear value')}>
      <GenUXIcon name="x" />
    </span>
  );
}
