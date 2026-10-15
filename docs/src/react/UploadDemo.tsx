import { useId, useState } from 'react';
import { Select, Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import { TweakerSettings } from './AtlasTweaker';
import AtlasUpload from './AtlasUpload';
import { useI18n } from './useI18n';

// Chooser hints only; AtlasUpload still checks every chosen or dropped file locally.
const acceptedFiles = {
  text: 'text/plain,.txt',
  'text-and-images': 'text/plain,.txt,image/*',
} as const;
type AcceptedFiles = keyof typeof acceptedFiles;

/** Local selection only: chosen files are listed and counted but never leave this device. */
export default function UploadDemo({ documentation = false }: { documentation?: boolean }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [multiple, setMultiple] = useState(true);
  const [accepted, setAccepted] = useState<AcceptedFiles>('text');
  const settingsId = useId();
  const count = files.length;
  const settings = documentation ? (
    <TweakerSettings title="Upload settings">
      <div className="atlas-tweaker-token">
        <label htmlFor={`${settingsId}multiple`}>{t('Allow multiple files')}</label>
        <Switch
          id={`${settingsId}multiple`}
          checked={multiple}
          onChange={checked => setMultiple(checked)}
        />
      </div>
      <div className="atlas-tweaker-token">
        <label htmlFor={`${settingsId}accept`}>{t('Accepted files')}</label>
        <Select
          id={`${settingsId}accept`}
          value={accepted}
          options={[
            { value: 'text', label: t('Text files only') },
            { value: 'text-and-images', label: t('Text files and images') },
          ]}
          onChange={(next: string) =>
            setAccepted(next === 'text-and-images' ? 'text-and-images' : 'text')
          }
        />
      </div>
    </TweakerSettings>
  ) : null;
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      {settings}
      <div className="atlas-upload-demo">
        <AtlasUpload
          label={t('Choose local files')}
          accept={acceptedFiles[accepted]}
          maxBytes={1024}
          multiple={multiple}
          onFilesChange={setFiles}
        />
        <p className="atlas-upload-count" role="status">
          {count === 0
            ? t('No files selected')
            : count === 1
              ? t('1 file selected')
              : t('{count} files selected', { count: String(count) })}
        </p>
      </div>
    </AtlasProvider>
  );
}
