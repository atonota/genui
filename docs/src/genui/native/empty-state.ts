import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';

const KINDS: readonly string[] = ['empty', 'no-match', 'error'];
const TEXT_LIMITS = Object.freeze({ title: 160, description: 600, actionLabel: 60 });

/** Caller-supplied plain text: non-blank, bounded and free of control characters. */
function assertPlainText(value: unknown, label: string, max: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /\p{Cc}/u.test(value))
    throw new Error(`Empty state ${label} is invalid.`);
}

export const definition: NativeDefinition = {
  name: 'AtlasEmptyState',
  // Presentation only; the optional recovery action is granted by the trusted core.
  readOnly: true,
  parse(input) {
    const data = nativeRecord(
      input,
      ['kind', 'title', 'description', 'actionLabel', 'headingLevel'],
      ['kind', 'title'],
    );
    if (typeof data.kind !== 'string' || !KINDS.includes(data.kind))
      throw new Error('Empty state kind is invalid.');
    assertPlainText(data.title, 'title', TEXT_LIMITS.title);
    if (Object.hasOwn(data, 'description'))
      assertPlainText(data.description, 'description', TEXT_LIMITS.description);
    if (Object.hasOwn(data, 'actionLabel'))
      assertPlainText(data.actionLabel, 'action label', TEXT_LIMITS.actionLabel);
    if (
      Object.hasOwn(data, 'headingLevel') &&
      !(
        typeof data.headingLevel === 'number' &&
        Number.isInteger(data.headingLevel) &&
        data.headingLevel >= 2 &&
        data.headingLevel <= 6
      )
    )
      throw new Error('Empty state heading level is invalid.');
    return data;
  },
};

export const sample: NativePayload = {
  kind: 'no-match',
  title: 'No matching records',
  description: 'Try a different search term.',
  actionLabel: 'Clear search',
  headingLevel: 3,
};
