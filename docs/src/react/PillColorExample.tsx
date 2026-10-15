import { useRef, useState, type ComponentRef, type MouseEvent } from 'react';
import { Button } from 'antd';
import AtlasPill, { AtlasPillColorScope } from './AtlasPill';
import { useI18n } from './useI18n';
import type { PillVariant } from '../data/pill-surfaces';

/** A collection with no input field: the Pill scope owns all color assignments. */
export default function PillColorExample({
  radius,
  variant,
}: {
  radius?: string;
  variant: PillVariant;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState(['design', 'engineering', 'operations']);
  const next = useRef(1);
  const list = useRef<HTMLDivElement>(null);
  const add = useRef<ComponentRef<typeof Button>>(null);
  function remove(event: MouseEvent, value: string) {
    if (event.currentTarget.contains(document.activeElement)) {
      const actions = [...(list.current?.querySelectorAll<HTMLElement>('.atlas-pill-close') ?? [])];
      const index = actions.indexOf(event.currentTarget as HTMLElement);
      const target = actions[index + 1] ?? actions[index - 1];
      if (target) target.focus();
      else add.current?.focus();
    }
    setValues(current => current.filter(item => item !== value));
  }
  const label = (value: string) =>
    ({ design: t('Design'), engineering: t('Engineering'), operations: t('Operations') })[value] ??
    t('Label {count}', { count: value.slice(6) });
  return (
    <div className="example-block pill-auto-example" data-pill-automatic>
      <h4>{t('Automatic color distribution')}</h4>
      <p>
        {t(
          'A random first color, then a different least-used color. Existing labels keep their colors when you add or remove others.',
        )}
      </p>
      <AtlasPillColorScope values={values}>
        <div className="atlas-pill-list" ref={list}>
          {values.map(value => (
            <AtlasPill
              key={value}
              colorKey={value}
              variant={variant}
              radius={radius}
              closable
              onClose={event => remove(event, value)}
            >
              {label(value)}
            </AtlasPill>
          ))}
        </div>
      </AtlasPillColorScope>
      <div className="control-row">
        <Button
          ref={add}
          type="primary"
          onClick={() => {
            const value = `label-${next.current++}`;
            setValues(current => [...current, value]);
          }}
        >
          {t('Add tag')}
        </Button>
        <Button
          type="text"
          disabled={values.length === 0}
          onClick={() => {
            setValues([]);
            add.current?.focus();
          }}
        >
          {t('Clear tags')}
        </Button>
      </div>
      <p role="status">{t('{count} tags · 17 color families', { count: values.length })}</p>
    </div>
  );
}
