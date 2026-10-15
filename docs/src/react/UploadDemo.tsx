import { useState } from 'react';
import AtlasProvider from './AtlasProvider';
import AtlasUpload from './AtlasUpload';
import { useI18n } from './useI18n';

/** Local selection only: chosen files are listed and counted but never leave this device. */
export default function UploadDemo({ documentation = false }: { documentation?: boolean }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const count = files.length;
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <div className="atlas-upload-demo">
        <AtlasUpload
          label={t('Choose local files')}
          accept="text/plain,.txt"
          maxBytes={1024}
          multiple
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
