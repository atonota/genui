import AtlasUpload, { type UploadMetadata } from '../../AtlasUpload';
import type { JsonValue } from '../../../genui/contracts';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, uploadSettings } from '../../../genui/native/upload';

// Matches the native value bound, enforced before a chosen or dropped file joins the list.
const MAX_FILES = 24;

/** Host metadata for a controlled list; an absent value leaves the list uncontrolled. */
const uploadValue = (value: JsonValue | undefined): UploadMetadata[] | undefined =>
  Array.isArray(value)
    ? value.flatMap(item =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof item.name === 'string' &&
        typeof item.type === 'string' &&
        typeof item.size === 'number'
          ? [{ name: item.name, type: item.type, size: item.size }]
          : [],
      )
    : undefined;

/** Local selection through AtlasUpload. File handles stay in the component; only name, type and size leave it. */
export default function NativeUpload({ data, disabled, onChange }: NativeAdapterProps) {
  const parsed = definition.parse(data);
  const upload = uploadSettings(parsed);
  return (
    <AtlasUpload
      label={upload.label}
      accept={upload.accept}
      maxBytes={upload.maxBytes}
      multiple={upload.multiple}
      maxFiles={MAX_FILES}
      // undefined keeps an enclosing ConfigProvider disable in effect.
      disabled={disabled || upload.disabled || undefined}
      value={uploadValue(parsed.value)}
      onValueChange={onChange}
    />
  );
}
