import { useId, useState } from 'react';
import { Select } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXAvatar, { type GenUXAvatarProps } from './GenUXAvatar';
import { TweakerSettings } from './GenUXTweaker';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

// Fictional local illustration; no remote asset or user-supplied markup.
const alexReedImage = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='#4f6b5d'/><circle cx='32' cy='26' r='12' fill='#efe4cf'/><path d='M10 64c2-14 11-21 22-21s20 7 22 21z' fill='#efe4cf'/></svg>`,
)}`;
// Intentionally missing so the page demonstrates the initials fallback.
const missingImage = '/genux-avatar-missing-example.png';

const people: readonly { name: string; src?: string; context: string; standalone?: boolean }[] = [
  { name: 'Alex Reed', src: alexReedImage, context: 'Embedded fictional illustration' },
  {
    name: 'Ada Lovelace',
    src: missingImage,
    context: 'Demonstration: the image path is missing, so initials replace it',
  },
  { name: 'Sam Lee', context: 'No image supplied, so initials are shown' },
  { name: '   ', context: 'No name supplied, so a question mark is shown' },
  {
    name: 'Grace Hopper',
    context: 'No visible name beside it, so the avatar itself announces the person name',
    standalone: true,
  },
];

type AvatarShape = NonNullable<GenUXAvatarProps['shape']>;

function AvatarExamples() {
  const { t } = useI18n();
  const shapeId = useId();
  // Presentation only; the example owns the shape, so it survives closing the Tweaker.
  const [shape, setShape] = useState<AvatarShape>('circle');
  return (
    <section className="genux-avatar-examples" aria-label={t('Avatar examples')}>
      <TweakerSettings title="Avatar">
        <div className="genux-tweaker-token">
          <label htmlFor={shapeId}>{t('Avatar shape')}</label>
          <Select<AvatarShape>
            id={shapeId}
            value={shape}
            options={[
              { value: 'circle', label: t('Circle') },
              { value: 'square', label: t('Square') },
            ]}
            onChange={next => setShape(next)}
          />
        </div>
      </TweakerSettings>
      <ExamplePreview id="avatar-people" title={t('Avatar examples')}>
        <ul className="genux-avatar-people">
          {people.map(person => (
            <li key={person.context} className="genux-avatar-person">
              {/* A visible name already identifies the person, so the paired avatar is decorative. */}
              <GenUXAvatar
                name={person.name}
                src={person.src}
                shape={shape}
                decorative={!person.standalone}
              />
              <div className="genux-avatar-person-text">
                {!person.standalone && (
                  <span className="genux-avatar-person-name">
                    {person.name.trim() || t('Unknown person')}
                  </span>
                )}
                <p className="genux-avatar-person-context">{t(person.context)}</p>
              </div>
            </li>
          ))}
        </ul>
      </ExamplePreview>
    </section>
  );
}

export default function AvatarDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <AvatarExamples />
    </GenUXProvider>
  );
}
