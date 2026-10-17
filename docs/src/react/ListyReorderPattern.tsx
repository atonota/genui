import { useId, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { Radio } from 'antd';
import GenUXButton from './GenUXButton';
import GenUXListy, { type GenUXListyEntry } from './GenUXListy';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

type Step = -1 | 1;

const rows = [
  { key: 'product', label: 'Product design' },
  { key: 'documentation', label: 'Documentation' },
  { key: 'engineering', label: 'Engineering' },
] as const;
// Private payload type: only rows dragged from this list are accepted as drop sources.
const dragType = 'application/x-genux-listy-key';

/**
 * Reorderable Listy. Each row holds a named themed radio that selects it by click, Space or the
 * arrow keys; native HTML drag and drop reorders with a mouse, and the toolbar outside the list
 * moves the selected row by keyboard or touch.
 */
export default function ListyReorderPattern() {
  const { t } = useI18n();
  const headingId = useId();
  const radioName = useId();
  const toolbar = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<readonly string[]>(() => rows.map(row => row.key));
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const labels = new Map<string, string>(rows.map(row => [row.key, t(row.label)]));
  const nameOf = (key: string) => labels.get(key) ?? key;
  const index = selected === null ? -1 : order.indexOf(selected);
  const blocked = (step: Step) => index < 0 || index + step < 0 || index + step >= order.length;
  const upBlocked = blocked(-1);
  const downBlocked = blocked(1);

  // A natively disabled GenUXButton drops keyboard focus, so bounds use aria-disabled and the
  // keyboard user keeps their place in the toolbar once a move reaches the first or last slot.
  useLayoutEffect(() => {
    const buttons = toolbar.current?.querySelectorAll<HTMLElement>('[data-listy-move]');
    buttons?.forEach(button => {
      const off = button.dataset.listyMove === 'up' ? upBlocked : downBlocked;
      button.setAttribute('aria-disabled', String(off));
    });
  }, [upBlocked, downBlocked]);

  const select = (key: string) => {
    setSelected(key);
    setMessage(t('Selected {label}', { label: nameOf(key) }));
  };

  const place = (key: string, target: number) => {
    const from = order.indexOf(key);
    if (from < 0 || from === target || target < 0 || target >= order.length) return;
    const next = order.filter(item => item !== key);
    next.splice(target, 0, key);
    setOrder(next);
    setMessage(
      t('{label} moved to position {position} of {total}', {
        label: nameOf(key),
        position: String(target + 1),
        total: String(next.length),
      }),
    );
  };

  const shift = (step: Step) => {
    if (selected === null) {
      setMessage(t('Select a row to move it'));
    } else if (blocked(step)) {
      const label = nameOf(selected);
      setMessage(
        step < 0
          ? t('{label} is already first', { label })
          : t('{label} is already last', { label }),
      );
    } else {
      place(selected, index + step);
    }
  };

  const items: GenUXListyEntry[] = order.map((key, position) => {
    const label = nameOf(key);
    const active = key === selected;
    const params = { label, position: String(position + 1), total: String(order.length) };
    return {
      key,
      label,
      selected: active,
      interactive: true,
      // The themed Radio keeps a named native radio underneath: one shared name gives checked
      // state plus native Space and arrow keys; a row click is the pointer shortcut.
      leading: (
        <Radio
          name={radioName}
          checked={active}
          onChange={event => {
            if (event.target.checked) select(key);
          }}
          aria-label={t('{label}, position {position} of {total}', params)}
        />
      ),
      rowProps: {
        draggable: true,
        onClick: () => select(key),
        onDragStart: (event: DragEvent<HTMLDivElement>) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(dragType, key);
          event.dataTransfer.setData('text/plain', label);
        },
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          if (!event.dataTransfer.types.includes(dragType)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
          const source = event.dataTransfer.getData(dragType);
          if (!source) return;
          event.preventDefault();
          place(source, position);
        },
      },
    };
  });

  return (
    <section
      className="genux-listy-pattern"
      data-listy-pattern="draggable"
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>{t('Draggable')}</h3>
      <p>{t('Drag a row with a mouse, or select a row and use Move up or Move down.')}</p>
      <ExamplePreview id="listy-draggable" title={t('Draggable')}>
        <GenUXListy label={t('Reorderable teams')} items={items} />
        <div
          ref={toolbar}
          className="genux-listy-pattern-toolbar"
          role="group"
          aria-label={t('Move selected row')}
        >
          <GenUXButton
            text={t('Move up')}
            fill="outline"
            data-listy-move="up"
            onClick={() => shift(-1)}
          />
          <GenUXButton
            text={t('Move down')}
            fill="outline"
            data-listy-move="down"
            onClick={() => shift(1)}
          />
        </div>
        <p className="genux-listy-pattern-status" role="status">
          {message}
        </p>
      </ExamplePreview>
    </section>
  );
}
