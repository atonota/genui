import { extensionComponents } from './catalog-extensions';
import { contentComponents } from './catalog-content';
import { uxPatternComponents } from './catalog-ux-patterns';
import { listyComponents } from './catalog-listy';
import { badgeComponents } from './catalog-badge';
import { fabComponents } from './catalog-fab';

export type ComponentDoc = {
  slug: string;
  title: string;
  summary: string;
  antdComponent: string;
  category: string;
  sourceUrl: string;
  whenToUse: string[];
  examples: {
    id: string;
    title: string;
    description: string;
    code: string;
  }[];
  api: {
    property: string;
    type: string;
    defaultValue: string;
    description: string;
  }[];
  apiDescription?: string;
  nativeApi?: ComponentDoc['api'];
  accessibility: string[];
  notes: string[];
};

/** Public Ant Design 6.6.6 APIs. Project styling is supplied by the docs theme. */
export const components: ComponentDoc[] = [
  {
    slug: 'button',
    title: 'Button',
    summary:
      'Actions share three sizes, five surfaces and one Processing state. Wrapped double and triple choices, search and icon-only actions use the same GenUX controls.',
    antdComponent: 'Button',
    category: 'Actions',
    sourceUrl: 'https://ant.design/components/button/',
    whenToUse: [
      'For a clear action such as saving, continuing or opening a panel.',
      'To distinguish the primary action from secondary and destructive actions.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Basic action',
        description:
          'GenUXButton represents actions. onClick connects the action; htmlType states the form behavior explicitly. Native form, name and id attributes pass through to Ant Design Button. Use Ant Design Typography.Link for links.',
        code: `import GenUXButton from '../src/react/GenUXButton';

export default function BasicButton({ onContinue }: { onContinue: () => void }) {
  return (
    <GenUXButton
      id="continue-action"
      name="continue"
      htmlType="button"
      onClick={onContinue}
      text="Continue"
    />
  );
}`,
      },
      {
        id: 'icon-only',
        title: 'Icon only',
        description:
          'GenUXIconButton shares GenUXButton sizes, radii, bottom lip and states. Its square presentation requires an aria-label describing the action; the icon does not replace an accessible name.',
        code: `import GenUXIconButton from '../src/react/GenUXIconButton';

export default function IconActions({ onAdd, onRemove }: { onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="control-row">
      <GenUXIconButton icon="plus" aria-label="Increase" onClick={onAdd} />
      <GenUXIconButton icon="trash" aria-label="Delete" onClick={onRemove} />
    </div>
  );
}`,
      },
      {
        id: 'variants',
        title: 'Semantic variants',
        description:
          'Native type/variant defines the action hierarchy. Visual sizes and radii use shared project tokens.',
        code: `import { Space } from 'antd';
import GenUXButton from '../src/react/GenUXButton';

export default function ButtonVariants() {
  return <Space wrap>
    <GenUXButton fill="solid" text="Save" />
    <GenUXButton fill="outline" text="Cancel" />
    <GenUXButton fill="tint" text="Preview" />
    <GenUXButton fill="text" text="Details" />
    <GenUXButton fill="link" href="#usage" text="Usage" />
    <GenUXButton disabled text="Unavailable" />
  </Space>;
}`,
      },
      {
        id: 'dimensions',
        title: 'Approved sizes and widths',
        description:
          'The size and width gallery reads the shared decision model. Content width follows the label; Wide reserves at least 175 px and fits narrow containers; Full width uses native block behavior. Size and width are independent.',
        code: `import ApprovedButtonDimensions from '../src/react/ButtonDimensions';

export default function ButtonDimensions() {
  return <ApprovedButtonDimensions />;
}`,
      },
      {
        id: 'states',
        title: 'Interaction and Processing states',
        description:
          'The shared GenUXButton shows a thin moving line while processing and prevents repeat submission. This preview does not save data or start a network request.',
        code: `import GenUXButton from '../src/react/GenUXButton';
import genux from '../src/data/genux.json';

export default function ButtonStates() {
  return (
    <div className="state-grid">
      {genux.decisions.buttons.state_variants.map(state => (
        <GenUXButton key={state.value} state={state.value} />
      ))}
    </div>
  );
}`,
      },
      {
        id: 'button-groups',
        title: 'Double and triple buttons',
        description:
          'One shared wrapper contains two or three equal choices. Exactly one native radio is selected; arrow keys change the selection.',
        code: `import GenUXButtonGroup from '../src/react/GenUXButtonGroup';

export default function ButtonGroups() {
  return <div className="pattern-stack">
    <GenUXButtonGroup aria-label="Delivery" defaultValue="delivery" options={[
      {value:'delivery',label:'Delivery'}, {value:'pickup',label:'Pickup'}
    ]} />
    <GenUXButtonGroup aria-label="View" defaultValue="list" options={[
      {value:'list',label:'List'}, {value:'table',label:'Table'}, {value:'calendar',label:'Calendar'}
    ]} />
  </div>;
}`,
      },
    ],
    api: [
      {
        property: 'GenUXIconButton.icon / aria-label',
        type: 'GenUXIconName / string',
        defaultValue: 'Required / required',
        description:
          'Phosphor icon and action name. A square presentation uses the shared Button size; state, radius and onClick pass through to the same renderer.',
      },
      {
        property: 'GenUXButton.width',
        type: "'content' | 'wide' | 'full'",
        defaultValue: "'content'",
        description:
          'Content, Wide or Full width. The Wide minimum fits its container; full uses native block. Unknown values fall back to content.',
      },
      {
        property: 'GenUXButton.size',
        type: "'sm' | 'md' | 'lg'",
        defaultValue: "'md'",
        description:
          'Shared sizes are sm 48 px, md 56 px and lg 64 px. The default inherits the component profile; old size names are compatibility aliases.',
      },
      {
        property: 'GenUXButton.state',
        type: 'Default, Hover, Pressed, Disabled or Processing',
        defaultValue: "'default'",
        description:
          'Default, Hover, Pressed and Disabled remain distinct; Processing is the only busy presentation and blocks repeated activation.',
      },
      {
        property: 'type',
        type: "'primary' | 'default' | 'link' | 'text'",
        defaultValue: "'default'",
        description: 'Shorthand for common action hierarchies.',
      },
      {
        property: 'color / variant',
        type: 'ButtonColorType / ButtonVariantType',
        defaultValue: 'Depends on context',
        description:
          'Defines color and surface separately; when both are supplied, they take precedence over the type mapping.',
      },
      {
        property: 'htmlType',
        type: "'button' | 'submit' | 'reset'",
        defaultValue: "'button'",
        description: 'HTML form behavior. Use submit for submission.',
      },
      {
        property: 'loading / disabled',
        type: 'boolean / boolean',
        defaultValue: 'false / false',
        description: 'Processing indicator and unavailable action state.',
      },
      {
        property: 'size',
        type: "'small' | 'medium' | 'large'",
        defaultValue: "'medium'",
        description: 'Native Ant Design size; the shared GenUX profiles map to 48, 56 and 64 px.',
      },
      {
        property: 'icon / iconPlacement',
        type: "ReactNode / 'start' | 'end'",
        defaultValue: "— / 'start'",
        description:
          'Native horizontal icon placement. Top and bottom icons require project layout.',
      },
      {
        property: 'classNames / styles',
        type: 'ButtonProps semantic slots',
        defaultValue: '—',
        description: 'Applies scoped styles to root, content and icon slots.',
      },
    ],
    accessibility: [
      'Use a name describing the action. Supply a separate accessible name for icon-only actions.',
      'Keep keyboard focus visible with a non-surrounding indicator. Surrounding rings and hiding focus without an alternative are prohibited.',
      'Do not communicate errors or success with color alone. Announce the result in the related live status text.',
    ],
    notes: [
      'Buttons use sm/md/lg at 48/56/64 px and the existing 0, 3, 5 px and pill radii. Normal solid buttons have no surrounding border.',
      'GenUXIconButton composes the shared GenUXButton without a second visual renderer. Icon-only presentation is a web experiment; it adds no decisions to the existing Storybook gallery.',
      'Approved widths: Content, Wide and Full width. Narrow is experimental and is excluded from the decision gallery and selector.',
      'Preserves normal opacity 0.9, hover 1.0, Outfit (default weight 400, minimum 300), minimum 14px documentation text and natural 0 px letter spacing.',
      'The 4 px bottom layer, 2 px top layer when pressed, fixed body geometry and non-surrounding focus indicator are project CSS contracts rather than native Ant Design features.',
      'Processing is the only busy variant. Its thin progress line and Phosphor prohibited cursor show that repeated activation is blocked.',
      'Surfaces are solid, outline, pastel-filled, text and link, plus the Disabled state. The color families inherit the Color system with 10% white and 10% black; neutral identities are retained. Documentation press and release take 116.667 ms, 30% faster than the previous profile. Shared transient click waves use 400 ms Cubic motion and respect reduced motion.',
    ],
  },
  {
    slug: 'input',
    title: 'Input',
    summary:
      'Combines single-line, multiline, password, search and numeric inputs under the same semantic theme.',
    antdComponent: 'Input · InputNumber',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/input/',
    whenToUse: [
      'Use Input for free text and Input.TextArea for longer descriptions.',
      'Use InputNumber for numbers, Input.Search for search and Input.Password for concealed text.',
    ],
    examples: [
      {
        id: 'variants',
        title: 'Filled field',
        description:
          'The filled field has no visible surrounding border in its normal state. Gray fills in both themes are darker than the page and panel surfaces; the existing shadow is preserved.',
        code: `import { Input } from 'antd';

export default function InputVariants() {
  return (
    <Input aria-label="Your name" variant="filled" placeholder="Your name" />
  );
}`,
      },
      {
        id: 'specialized',
        title: 'Input types',
        description:
          'The numeric field uses shared icon buttons. At the configured minimum, the left trash action calls onRemove; above the minimum, minus decrements. Ant Design manages typing and arrow keys. Theme changes preserve the current input.',
        code: `import { Input, Space } from 'antd';
import { useState } from 'react';
import NumberStepper from '../src/react/NumberStepper';

export default function InputTypes() {
  const [quantity, setQuantity] = useState<string | number | null>(12);
  return (
    <Space orientation="vertical">
      <Input.Search aria-label="Search the catalog" variant="filled" placeholder="Search components" allowClear />
      <Input.Password aria-label="Password" variant="filled" autoComplete="new-password" />
      <NumberStepper aria-label="Quantity" variant="filled" min={12} max={99}
        value={quantity} onChange={setQuantity} onRemove={() => setQuantity(null)} />
      <Input.TextArea
        aria-label="Description"
        variant="filled"
        autoSize={{ minRows: 3, maxRows: 6 }}
        maxLength={240}
        showCount
      />
    </Space>
  );
}`,
      },
      {
        id: 'validation',
        title: 'Status and help text',
        description:
          'Error, warning, read-only and disabled fields use the filled surface. Errors and warnings may have a full red/orange border; help text is associated with the field.',
        code: `import { Form, Input } from 'antd';

export default function InputStates() {
  return (
    <Form name="input-states" layout="vertical" variant="filled" initialValues={{ email: 'example', username: 'sample', code: 'AT-001' }}>
      <Form.Item name="email" label="Email" validateStatus="error" help="Enter a valid email address.">
        <Input type="email" status="error" />
      </Form.Item>
      <Form.Item name="username" label="Username" validateStatus="warning" help="This name may already be in use.">
        <Input status="warning" />
      </Form.Item>
      <Form.Item name="code" label="Record code"><Input readOnly /></Form.Item>
      <Form.Item name="closed" label="Unavailable field"><Input disabled placeholder="Currently unavailable" /></Form.Item>
    </Form>
  );
}`,
      },
    ],
    api: [
      {
        property: 'NumberStepper.min / onRemove',
        type: 'number | string / (() => void)',
        defaultValue: '1 / undefined',
        description:
          'At the actual minimum, Phosphor trash replaces minus and only onRemove is called. Removal is disabled without a callback. ArrowDown preserves the numeric minimum and does not remove the value.',
      },
      {
        property: 'value / defaultValue',
        type: 'InputProps fields',
        defaultValue: '—',
        description: 'A controlled value or an initial value. Do not mix both on the same field.',
      },
      {
        property: 'onChange',
        type: '(event: ChangeEvent<HTMLInputElement>) => void',
        defaultValue: '—',
        description: 'Provides the current text through event.target.value.',
      },
      {
        property: 'variant',
        type: "'filled'",
        defaultValue: "'filled' (project)",
        description:
          'The default project field surface has no visible surrounding border in the normal state. See the official reference for the full Ant Design API.',
      },
      {
        property: 'status',
        type: "'error' | 'warning'",
        defaultValue: '—',
        description: 'Visual validation status; it does not create validation rules or error text.',
      },
      {
        property: 'size',
        type: "'small' | 'medium' | 'large'",
        defaultValue: "'medium'",
        description: 'Native field size. The shared theme preserves the minimum text size.',
      },
      {
        property: 'allowClear / readOnly / disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Clearing, read-only state and availability are independent.',
      },
      {
        property: 'Input.TextArea.autoSize',
        type: 'boolean | { minRows?: number; maxRows?: number }',
        defaultValue: 'false',
        description: 'Expands the multiline field to fit its content.',
      },
    ],
    accessibility: [
      'A placeholder does not replace a label. Provide a visible label or an equivalent accessible name.',
      'Associate error text with the field and provide an explanation beyond color. Explain required fields in text.',
      'Use appropriate type, inputMode and autoComplete values for mobile keyboards. Preserve zoom and user font preferences.',
    ],
    notes: [
      'InputNumber is a separate component; its onChange value differs from the Input text event.',
      'NumberStepper places real GenUXIconButton actions alongside InputNumber, without interactive buttons inside native icon slots. A button click produces one step; typing and arrow keys retain native behavior. The application handles removal in onRemove.',
      'The project offers only the filled field surface. Normal surrounding borders are invisible; existing shadows, semantic error/warning borders and single-edge keyboard focus are preserved. This catalog records no new decisions.',
      'Light gray and dark gray field fills are darker than their page and panel backgrounds. Shared surface tokens are used; theme changes do not reset data through keys or conditional component trees.',
    ],
  },
  {
    slug: 'autocomplete',
    title: 'AutoComplete',
    summary:
      'Offer useful completions while keeping people in control of their text. Groups, descriptions and a context preview make the right suggestion easier to recognize.',
    antdComponent: 'AutoComplete',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/auto-complete/',
    whenToUse: [
      'For editable text with recognizable suggestions, such as a team name, documentation term or repeated address suffix.',
      'Use Select when a value must come from a fixed list. AutoComplete keeps a custom value even when no suggestion matches.',
      'Group related suggestions and explain similar choices. Keep metadata meaningful; do not invent popularity, counts or live availability.',
    ],
    examples: [
      {
        id: 'context',
        title: 'Find with context',
        description:
          'The host controls the text and selected context separately. Choosing a suggestion reveals its purpose; editing or clearing removes a stale choice.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAutoComplete from '../src/react/GenUXAutoComplete';
import '../src/styles/genux-autocomplete.css';
const items = [
  { key: 'button', value: 'Button', title: 'Button', description: 'Choose an action and its emphasis.', group: { key: 'components', label: 'Components' }, meta: 'Actions' },
  { key: 'start', value: 'Getting started', title: 'Getting started', description: 'Set up shared native components.', group: { key: 'guides', label: 'Guides' }, meta: 'Setup' },
];
export default function GroupedCompletion() {
  const [value, setValue] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find(item => item.key === selectedKey);
  return <GenUXProvider appearance="docs"><GenUXAutoComplete label="Find documentation" value={value} items={items}
    onChange={next => { setValue(next); setSelectedKey(null); }} onSelect={item => setSelectedKey(item.key)}
    help="Type freely or choose a suggestion to see its purpose." />
    <p role="status">{selected ? selected.description : 'Choose a suggestion to preview its context.'}</p>
  </GenUXProvider>;
}`,
      },
      {
        id: 'completion',
        title: 'Useful completions',
        description:
          'Generate suggested suffixes from the current input. The typed value stays unchanged until someone explicitly chooses a completion.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAutoComplete from '../src/react/GenUXAutoComplete';
import '../src/styles/genux-autocomplete.css';
export default function EmailCompletion() {
  const [value, setValue] = useState('');
  const name = value.trim().split('@')[0] ?? '';
  const items = name ? ['example.com', 'example.org'].map(domain => ({
    key: domain, value: name + '@' + domain, title: name + '@' + domain, description: 'Complete with a sample domain',
  })) : [];
  return <GenUXProvider appearance="docs"><GenUXAutoComplete label="Contact email" value={value} onChange={setValue} items={items}
    placeholder="name@example.com" help="These are sample domains. You can enter your own address." /></GenUXProvider>;
}`,
      },
      {
        id: 'recovery',
        title: 'Suggestions and recovery',
        description:
          'Availability belongs to the caller. This local error sample recovers only through Retry, with no fabricated request or timer and no lost draft.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAutoComplete from '../src/react/GenUXAutoComplete';
import '../src/styles/genux-autocomplete.css';
export default function CompletionRecovery() {
  const [value, setValue] = useState('Keep my text');
  const [availability, setAvailability] = useState<'ready' | 'error'>('error');
  return <GenUXProvider appearance="docs"><GenUXAutoComplete label="Team suggestions" value={value} onChange={setValue}
    items={[{ key: 'genux', value: 'GenUX Studio', title: 'GenUX Studio' }]} availability={availability}
    onRetry={() => setAvailability('ready')} help="Local error sample. Retry restores the suggestions and preserves your text." /></GenUXProvider>;
}`,
      },
      {
        id: 'availability',
        title: 'Field availability',
        description:
          'Validation is a host rule, separate from suggestion availability. Give errors a linked explanation and keep disabled values and their reasons readable.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAutoComplete from '../src/react/GenUXAutoComplete';
import '../src/styles/genux-autocomplete.css';
export default function CompletionValidation() {
  const [value, setValue] = useState('');
  const error = value.trim().length < 2 ? 'Enter a team name with at least two characters.' : undefined;
  return <GenUXProvider appearance="docs"><GenUXAutoComplete label="Team name" value={value} onChange={setValue} items={[]}
    error={error} help="A custom team name is allowed." />
    <GenUXAutoComplete label="Assigned team" value="GenUX Studio" onChange={() => {}} items={[]} disabled
      help="Team assignment is unavailable in this local example." /></GenUXProvider>;
}`,
      },
    ],
    apiDescription:
      'GenUXAutoComplete wraps installed native Ant Design AutoComplete. It owns local suggestion filtering, grouped presentation and field feedback; the caller owns text, selected context, validation and availability.',
    api: [
      {
        property: 'id / label',
        type: 'string / string',
        defaultValue: 'Generated / Required',
        description:
          'Stable input identity and a visible associated label. A placeholder is never the only name.',
      },
      {
        property: 'value / onChange',
        type: 'string / (value: string) => void',
        defaultValue: 'Required',
        description:
          'Controlled text updates immediately, including typing, clearing and native suggestion selection. Custom text is retained; no matching option is required.',
      },
      {
        property: 'items',
        type: 'readonly GenUXSuggestion[]',
        defaultValue: 'Required',
        description:
          'Unique keys and values, a readable title, optional description, group, metadata, search keywords and disabled state. Search matches value, title, description and keywords without case or accent sensitivity.',
      },
      {
        property: 'onSelect',
        type: '(item: GenUXSuggestion) => void',
        defaultValue: 'undefined',
        description:
          'Called only for an explicit available suggestion selection. Use its stable key for context; typing alone never selects a record or opens a page.',
      },
      {
        property: 'placeholder / help',
        type: 'string / string',
        defaultValue: 'undefined',
        description:
          'A short input example and linked guidance. Keep required instructions outside the placeholder.',
      },
      {
        property: 'status / error',
        type: "'error' | 'warning' / string",
        defaultValue: 'undefined',
        description:
          'The host supplies validation. An error message implies error status and aria-invalid, links to the input and announces the issue. A warning remains editable.',
      },
      {
        property: 'availability / onRetry',
        type: "'ready' | 'loading' | 'error' / (() => void)",
        defaultValue: "'ready' / undefined",
        description:
          'Suggestion availability is independent from field validity. Loading/error keep text editable. Error exposes an explicit Retry action when supplied; the host performs any actual request.',
      },
      {
        property: 'disabled',
        type: 'boolean',
        defaultValue: 'ConfigProvider value or false',
        description:
          'Disables editing, clearing and selection while preserving the current value and guidance.',
      },
    ],
    nativeApi: [
      {
        property: 'options',
        type: 'DefaultOptionType[]',
        defaultValue: '[]',
        description:
          'Native value/label suggestions and grouped options. GenUX maps serializable suggestion data to native labels.',
      },
      {
        property: 'onChange / onSelect',
        type: '(value) => void / (value, option) => void',
        defaultValue: 'undefined',
        description:
          'Native editable value and explicit selection events. GenUX forwards the text and resolves the selected suggestion.',
      },
      {
        property: 'showSearch.filterOption',
        type: 'boolean | function',
        defaultValue: 'false (GenUX)',
        description:
          'Native filtering is disabled because GenUX already filters the supplied local suggestion data.',
      },
      {
        property: 'defaultActiveFirstOption / backfill',
        type: 'boolean / boolean',
        defaultValue: 'false / false (GenUX)',
        description:
          'GenUX requires a deliberate choice and keeps arrow navigation from replacing the entered text.',
      },
      {
        property: 'notFoundContent',
        type: 'ReactNode',
        defaultValue: 'GenUX status content',
        description:
          'Native empty-list presentation distinguishes no match, unavailable suggestions and loading without fake selectable items.',
      },
      {
        property: 'allowClear / virtual',
        type: 'boolean | object / boolean',
        defaultValue: 'Branded clear action / false (GenUX)',
        description:
          'The native clear action uses its accessible label and GenUX icon. Small local suggestion sets render without virtualization.',
      },
    ],
    accessibility: [
      'The visible label names the editable combobox. Guidance, result feedback and error messages remain associated with the same mounted input.',
      'Native arrow keys move through available suggestions, Enter chooses one and Escape dismisses the popup. IME composition never becomes an accidental suggestion selection.',
      'No match and unavailable suggestions keep custom text usable. Counts and status feedback are announced; disabled suggestions cannot be chosen.',
      'Narrow popups wrap descriptions and keep readable text and shared control targets. Keyboard focus uses one non-surrounding marker, with no surrounding ring.',
    ],
    notes: [
      'This page uses local entries and explicit sample availability states. It does not search a backend, verify an email address, create a team or pretend that a request is running.',
      'Use onChange for the controlled value rather than onSearch. Native suggestion selection and text composition are different events; entered text must stay immediate.',
      'The shared sm/md/lg profile supplies 48/56/64px controls. Settings stay in the initially closed Tweaker; size, detail, theme and language changes preserve drafts and selected context.',
      'Only this documentation route loads the AutoComplete master and catalog styles. Storybook, approved decisions and GenUX capability registries are unchanged.',
    ],
  },
  {
    slug: 'cascader',
    title: 'Cascader',
    summary:
      'Choose a destination through a clear hierarchy. Search complete paths, distinguish similar names and review multiple selections without losing context.',
    antdComponent: 'Cascader',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/cascader/',
    whenToUse: [
      'For a structured choice with several levels, such as a team and area, category or record group.',
      'Use searchable paths when people know part of the destination. Keep full-path context when leaf names repeat.',
      'Use Select for a flat list and AutoComplete for free text. Cascader commits a supplied hierarchical value.',
    ],
    examples: [
      {
        id: 'search',
        title: 'Browse or search',
        description:
          'The caller owns the selected path. Search combines terms across ancestors, leaves, descriptions and keywords; browsing never commits a leaf selection.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport GenUXCascader, { type GenUXCascadeOption } from '../src/react/GenUXCascader';\nimport '../src/styles/genux-cascader.css';\nconst options: GenUXCascadeOption[] = [{ value: 'studio', label: 'Studio', children: [\n  { value: 'design', label: 'Design', children: [{ value: 'review', label: 'Review', description: 'Review design systems' }] },\n  { value: 'engineering', label: 'Engineering', children: [{ value: 'review', label: 'Review', description: 'Review release quality' }] },\n] }];\nexport default function SearchablePath() {\n  const [value, setValue] = useState<string[]>([]);\n  return <GenUXProvider appearance=\"docs\"><GenUXCascader label=\"Destination\" options={options}\n    value={value} onChange={setValue} help=\"Try engineering review.\" /></GenUXProvider>;\n}",
      },
      {
        id: 'multiple',
        title: 'Select several paths',
        description:
          'Native checking preserves partial branches. Choose parent summaries or individual leaves; keep a readable full selection beside the field.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport GenUXCascader, { type GenUXCascadeOption } from '../src/react/GenUXCascader';\nimport '../src/styles/genux-cascader.css';\nconst options: GenUXCascadeOption[] = [{ value: 'studio', label: 'Studio', children: [\n  { value: 'design', label: 'Design', children: [{ value: 'review', label: 'Review', description: 'Review design systems' }] },\n  { value: 'engineering', label: 'Engineering', children: [{ value: 'review', label: 'Review', description: 'Review release quality' }] },\n] }];\nexport default function MultiplePaths() {\n  const [value, setValue] = useState<string[][]>([]);\n  return <GenUXProvider appearance=\"docs\"><GenUXCascader label=\"Assigned areas\" options={options}\n    multiple value={value} onChange={setValue} checkedStrategy=\"child\" /></GenUXProvider>;\n}",
      },
      {
        id: 'display',
        title: 'Path presentation',
        description:
          'A final-item label keeps the control compact. Render the complete path nearby; changeOnSelect allows an intentional earlier branch choice.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport GenUXCascader, { type GenUXCascadeOption } from '../src/react/GenUXCascader';\nimport '../src/styles/genux-cascader.css';\nconst options: GenUXCascadeOption[] = [{ value: 'studio', label: 'Studio', children: [\n  { value: 'design', label: 'Design', children: [{ value: 'review', label: 'Review', description: 'Review design systems' }] },\n  { value: 'engineering', label: 'Engineering', children: [{ value: 'review', label: 'Review', description: 'Review release quality' }] },\n] }];\nexport default function CompactPath() {\n  const [value, setValue] = useState<string[]>(['studio', 'engineering', 'review']);\n  return <GenUXProvider appearance=\"docs\"><GenUXCascader label=\"Destination\" options={options}\n    value={value} onChange={setValue} selectionLabel=\"leaf\" changeOnSelect />\n    <p>{value.join(' / ')}</p></GenUXProvider>;\n}",
      },
      {
        id: 'lazy',
        title: 'Reveal on demand',
        description:
          'The host supplies children after a branch is opened. Native loadData and search cannot be combined; this example reveals local data without a request.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport GenUXCascader, { type GenUXCascadeOption } from '../src/react/GenUXCascader';\nimport '../src/styles/genux-cascader.css';\nexport default function LocalReveal() {\n  const [value, setValue] = useState<string[]>([]);\n  const [loaded, setLoaded] = useState(false);\n  const options: GenUXCascadeOption[] = [{ value: 'collection', label: 'Collection', isLeaf: false,\n    ...(loaded ? { children: [{ value: 'active', label: 'Active records' }] } : {}) }];\n  return <GenUXProvider appearance=\"docs\"><GenUXCascader label=\"Record group\" options={options}\n    value={value} onChange={setValue} searchable={false} loadData={() => setLoaded(true)} /></GenUXProvider>;\n}",
      },
    ],
    apiDescription:
      'GenUXCascader wraps native Ant Design6.6.6 Cascader. Native navigation and branch checking stay intact; GenUX adds complete-path search, branded presentation and a bounded tree accessibility adapter.',
    api: [
      {
        property: 'id / label',
        type: 'string / string',
        defaultValue: 'Generated / Required',
        description:
          'A stable input ID and visible associated label. Help and validation share this identity.',
      },
      {
        property: 'options',
        type: 'readonly GenUXCascadeOption[]',
        defaultValue: 'Required',
        description:
          'Stable string values unique among siblings, readable labels, optional descriptions, keywords, disabled state, children and isLeaf. The caller replaces options when data changes.',
      },
      {
        property: 'value / onChange',
        type: 'string[] | string[][] / function',
        defaultValue: 'Required',
        description:
          'A controlled full path for single selection, or full paths for multiple selection. Native selection and clearing emit immediately; typing and arrow browsing do not commit a leaf.',
      },
      {
        property: 'multiple / checkedStrategy',
        type: "boolean / 'parent' | 'child'",
        defaultValue: "false / 'parent'",
        description:
          'Multiple selection conducts checks through branches. Parent summaries compress complete branches; child summaries return individual leaves. The host owns the resulting representation.',
      },
      {
        property: 'selectionLabel / changeOnSelect',
        type: "'path' | 'leaf' / boolean",
        defaultValue: "'path' / false",
        description:
          'Single selection displays the full path or final label. changeOnSelect permits an earlier branch selection; it is unavailable in multiple mode.',
      },
      {
        property: 'searchable / loadData',
        type: 'boolean / (path: string[]) => void',
        defaultValue: 'true / undefined',
        description:
          'Search is local, accent-insensitive and token-based across complete paths. Results are limited to30. loadData requires searchable=false; the host owns loading, failure feedback and any real request.',
      },
      {
        property: 'help / error / status',
        type: 'string / string / error | warning',
        defaultValue: 'undefined',
        description:
          'Linked guidance and validation are supplied by the host. Error implies aria-invalid and an announced message; warnings remain editable.',
      },
      {
        property: 'disabled',
        type: 'boolean',
        defaultValue: 'ConfigProvider value or false',
        description: 'Prevents editing, clearing and selection while retaining the current path.',
      },
    ],
    nativeApi: [
      {
        property: 'showSearch',
        type: 'boolean | SearchConfig',
        defaultValue: 'GenUX search configuration',
        description:
          'Nested searchValue/onSearch manage the draft. filter matches complete paths and render keeps a readable full trail; no private native search markers are used.',
      },
      {
        property: 'multiple / showCheckedStrategy',
        type: 'boolean / SHOW_PARENT | SHOW_CHILD',
        defaultValue: 'false / SHOW_PARENT',
        description:
          'Native branch conduction and indeterminate checkbox state. GenUX maps its parent/child contract to the installed native constants.',
      },
      {
        property: 'optionRender / displayRender',
        type: 'function / function',
        defaultValue: 'GenUX renderers',
        description:
          'Option descriptions appear only in the popup. Plain string labels keep the selected control measurable and compact.',
      },
      {
        property: 'loadData',
        type: '(selectedOptions) => void',
        defaultValue: 'undefined',
        description:
          'Native lazy branch expansion cannot be combined with showSearch. GenUX passes stable path values to the host.',
      },
      {
        property: 'popupRender / classNames / getPopupContainer',
        type: 'function / object / function',
        defaultValue: 'GenUX contained popup',
        description:
          'The popup uses local theme tokens, a contained horizontal column scroller and a useful footer. The semantic adapter links actual tree items to the native combobox.',
      },
    ],
    accessibility: [
      'The visible label names the combobox. A tree popup exposes levels, expanded branches, selection, unavailable items and mixed checks, with real active-descendant IDs.',
      'Native Up/Down navigates choices, Right/Left moves between levels, Enter selects and Escape closes. IME composition never becomes an accidental selection.',
      'At narrow widths, columns scroll inside the popup and the active column is brought into view. Field and page stay inside the viewport; text and shared targets remain readable.',
      'Keyboard focus uses a single visible edge marker, never a surrounding ring. Reduced motion removes decorative transitions without delaying semantic updates.',
    ],
    notes: [
      'Examples use local data. They do not search a backend, assign permissions or simulate network progress. Lazy reveal is deliberately separate from searchable data.',
      'The shared sm/md/lg profile supplies48/56/64px fields and32/40/50px check marks. Theme, language and presentation changes keep mounted values.',
      'Cascader master and catalog assets load only on this route. No Storybook approval or GenUX registry capability is implied by this documentation example.',
    ],
  },
  {
    slug: 'select',
    title: 'Select',
    summary:
      'Supports single or multiple selection from a set of options. The control and popup share the same theme.',
    antdComponent: 'Select',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/select/',
    whenToUse: [
      'For predefined options that do not need to remain visible on screen.',
      'For searching long lists or selecting several values with multiple mode.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Single selection and search',
        description:
          'Uses the options data contract. Search matches option labels; the popup remains a branded menu rather than an operating system menu.',
        code: `import { Select } from 'antd';

const options = [
  { value: 'istanbul', label: 'Istanbul' },
  { value: 'ankara', label: 'Ankara' },
  { value: 'izmir', label: 'Izmir' },

];

export default function BasicSelect() {
  return (
    <Select<string>
      aria-label="City"
      variant="filled"
      placeholder="Choose a city"
      showSearch={{ optionFilterProp: 'label' }}
      allowClear
      options={options}
    />
  );
}`,
      },
      {
        id: 'multiple',
        title: 'Multiple selection and tags',
        description: 'multiple selects from the list. tags also allows users to enter new values.',
        code: `import { Select, Space } from 'antd';

const options = [
  { value: 'tasarim', label: 'Design' },
  { value: 'gelistirme', label: 'Development' },
  { value: 'test', label: 'Test' },
];

export default function MultipleSelect() {
  return (
    <Space orientation="vertical">
      <Select<string[]>
        aria-label="Teams"
        mode="multiple"
        variant="filled"
        defaultValue={['tasarim']}
        options={options}
        showSearch={{ optionFilterProp: 'label' }}
        allowClear
      />
      <Select<string[]>
        aria-label="Tags"
        mode="tags"
        variant="filled"
        placeholder="Enter a tag"
        options={options}
        showSearch={{ optionFilterProp: 'label' }}
      />
    </Space>
  );
}`,
      },
      {
        id: 'states',
        title: 'Validation and availability',
        description:
          'Loading indicates data loading; this example makes no data request. Form.Item explains errors and warnings.',
        code: `import { Form, Select } from 'antd';

const options = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived', disabled: true },
];

export default function SelectStates() {
  return (
    <Form name="select-states" layout="vertical" variant="filled" initialValues={{ warning: 'active', closed: 'active' }}>
      <Form.Item name="status" label="Status" validateStatus="error" help="Choose a status.">
        <Select status="error" options={options} placeholder="Choose" />
      </Form.Item>
      <Form.Item name="warning" label="Review needed" validateStatus="warning" help="Review the selection.">
        <Select status="warning" options={options} />
      </Form.Item>
      <Form.Item name="loading" label="Loading"><Select loading options={[]} /></Form.Item>
      <Form.Item name="closed" label="Off"><Select disabled options={options} /></Form.Item>
    </Form>
  );
}`,
      },
    ],
    api: [
      {
        property: 'options',
        type: 'Array<{ value; label; disabled? }>',
        defaultValue: '[]',
        description: 'Option data. Prefer the current API over Select.Option children.',
      },
      {
        property: 'value / onChange',
        type: 'ValueType / (value, option) => void',
        defaultValue: '—',
        description: 'Controlled selection. In multiple mode the value is an array.',
      },
      {
        property: 'mode',
        type: "'multiple' | 'tags'",
        defaultValue: 'Single selection',
        description: 'Allows multiple selections and optional creation of new tags.',
      },
      {
        property: 'showSearch',
        type: 'boolean | SearchConfig',
        defaultValue: 'Depends on mode',
        description: 'Search behavior. Use optionFilterProp: label for local text filtering.',
      },
      {
        property: 'variant / status',
        type: "'filled' / 'error' | 'warning'",
        defaultValue: 'filled (project) / —',
        description:
          'Defaults to the same filled surface as Input. Normal borders are invisible; error/warning borders may remain. See the official reference for the full Ant Design API.',
      },
      {
        property: 'allowClear / loading / disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Clearing, loading and interaction state.',
      },
      {
        property: 'classNames.popup / styles.popup',
        type: 'Semantic popup slots',
        defaultValue: '—',
        description:
          'Keeps the popup consistent with the theme. Use current slots instead of deprecated dropdownStyle.',
      },
    ],
    accessibility: [
      'Provide an accessible name. Preserve arrow keys, Enter, Escape, Tab and clearing behavior.',
      'Explain why an option is disabled with help text when needed.',
      'Preserve selection and focus management when customizing popupRender. A native select appearance does not satisfy the project contract.',
    ],
    notes: [
      'The showSearch object and semantic popup slots follow the installed Ant Design 6.6.6 API.',
      'The theme also applies to the list rendered through a portal; styling only the closed control is insufficient.',
      'Only the filled surface is offered. Light and dark gray field fills are darker than their surroundings. Existing shadows and visible non-surrounding keyboard focus are preserved.',
    ],
  },
  {
    slug: 'checkbox',
    title: 'Checkbox',
    summary: 'Manages independent yes/no values or multiple selections from a set.',
    antdComponent: 'Checkbox · Checkbox.Group',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/checkbox/',
    whenToUse: [
      'For preferences where several options may be checked at once.',
      'For consent and preference fields edited before submission.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Controlled preference',
        description: 'Read the boolean value from event.target.checked in the Checkbox event.',
        code: `import { useState } from 'react';
import { Checkbox } from 'antd';

export default function BasicCheckbox() {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox checked={checked} onChange={(event) => setChecked(event.target.checked)}>
      Receive email notifications
    </Checkbox>
  );
}`,
      },
      {
        id: 'group',
        title: 'Multiple options and disabled state',
        description:
          'The group produces an array of values. Individual options or the entire group may be disabled.',
        code: `import { Checkbox } from 'antd';

export default function CheckboxGroup() {
  return (
    <fieldset>
      <legend>Notification channels</legend>
      <Checkbox.Group<string>
        defaultValue={['email']}
        options={[
          { label: 'Email', value: 'email' },
          { label: 'SMS', value: 'sms' },
          { label: 'Phone', value: 'phone', disabled: true },
        ]}
      />
    </fieldset>
  );
}`,
      },
      {
        id: 'indeterminate',
        title: 'Partial selection',
        description:
          'Indeterminate is not a separate boolean model value; it indicates that some child options are checked.',
        code: `import { useState } from 'react';
import { Checkbox, Space } from 'antd';

const options = ['Design', 'Development', 'Test'];

export default function IndeterminateCheckbox() {
  const [selected, setSelected] = useState<string[]>(['Design']);
  const all = selected.length === options.length;
  const partial = selected.length > 0 && !all;
  return (
    <Space orientation="vertical">
      <Checkbox
        checked={all}
        indeterminate={partial}
        onChange={(event) => setSelected(event.target.checked ? options : [])}
      >
        All teams
      </Checkbox>
      <Checkbox.Group<string>
        aria-label="Teams"
        options={options}
        value={selected}
        onChange={setSelected}
      />
    </Space>
  );
}`,
      },
    ],
    api: [
      {
        property: 'checked / defaultChecked',
        type: 'boolean',
        defaultValue: 'false',
        description: 'A controlled value or an initial checked state.',
      },
      {
        property: 'onChange',
        type: '(event: CheckboxChangeEvent) => void',
        defaultValue: '—',
        description: 'The new checked state is in event.target.checked.',
      },
      {
        property: 'indeterminate',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Visual and accessible state for a partial group selection.',
      },
      {
        property: 'disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Disables interaction with the Checkbox or group.',
      },
      {
        property: 'Checkbox.Group.options',
        type: '(string | number | CheckboxOptionType)[]',
        defaultValue: '[]',
        description: 'Label, value and option-level disabled state.',
      },
      {
        property: 'Checkbox.Group.value / onChange',
        type: 'T[] / (checkedValue: T[]) => void',
        defaultValue: '—',
        description:
          'The group value is an array; its signature differs from a single Checkbox event.',
      },
    ],
    accessibility: [
      'Keep the text label inside the clickable area. Use fieldset/legend or an accessible group name.',
      'Preserve Space to toggle and Tab to navigate. The touch target is independent of the visible box.',
      'Do not indicate a partial state with color alone. Preserve native indeterminate semantics.',
    ],
    notes: [
      'Checkbox has no native size prop. Shared project tokens manage the visible box and touch target.',
      'Shared sm/md/lg selection boxes are 32/40/50 px square. Label hit areas stay at least 48 px. Radii share the Button source: 0, 3, 5 px and pill.',
      'The web check mark is a local Phosphor SVG mask. Selection updates immediately; the decorative mark uses a symmetric 280 ms easeInOutCubic transition. Reduced motion disables the transition.',
      'Use valuePropName="checked" to bind checked inside Form.Item.',
    ],
  },
  {
    slug: 'radio',
    title: 'Radio',
    summary:
      'Selects one related option. Circle and button presentations use the same group model.',
    antdComponent: 'Radio · Radio.Group · Segmented',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/radio/',
    whenToUse: [
      'When a small set of options should remain visible and only one may be selected.',
      'Use a button-style group to show a clear choice between related modes.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Single selection',
        description:
          'A shared name and visible group label preserve the relationship between options. Read the value from the event.',
        code: `import { useState } from 'react';
import { Radio } from 'antd';

export default function BasicRadio() {
  const [value, setValue] = useState('daily');
  return (
    <fieldset>
      <legend>Notification frequency</legend>
      <Radio.Group
        name="notification-frequency"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        options={[
          { label: 'Instant', value: 'instant' },
          { label: 'Daily', value: 'daily' },
          { label: 'Weekly', value: 'weekly' },
        ]}
      />
    </fieldset>
  );
}`,
      },
      {
        id: 'segments',
        title: 'Segmented selection',
        description:
          'The selected surface slides between options within one pill-shaped background. Native Segmented provides the value directly through onChange.',
        code: `import { Segmented } from 'antd';

const options = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

export default function SegmentedChoice() {
  return (
    <Segmented
      className="genux-segmented"
      name="period"
      aria-label="Period"
      shape="round"
      block
      tabIndex={-1}
      defaultValue="week"
      options={options}
    />
  );
}`,
      },
      {
        id: 'states',
        title: 'Vertical and disabled options',
        description:
          'Use vertical orientation in narrow spaces. Define availability at option or group level.',
        code: `import { Radio, Space } from 'antd';

const options = [
  { label: 'Standard', value: 'standard' },
  { label: 'Priority', value: 'priority' },
  { label: 'Unavailable option', value: 'unavailable', disabled: true },
];

export default function RadioStates() {
  return (
    <Space orientation="vertical">
      <Radio.Group aria-label="Delivery" orientation="vertical" defaultValue="standard" options={options} />
      <Radio.Group aria-label="Locked delivery" disabled defaultValue="standard" options={options} />
    </Space>
  );
}`,
      },
    ],
    api: [
      {
        property: 'Radio.Group.value / defaultValue',
        type: 'Option value',
        defaultValue: '—',
        description: 'A controlled single selection or an initial selection.',
      },
      {
        property: 'onChange',
        type: '(event: RadioChangeEvent) => void',
        defaultValue: '—',
        description: 'The new selection is in event.target.value.',
      },
      {
        property: 'options',
        type: '(string | number | CheckboxOptionType)[]',
        defaultValue: '[]',
        description: 'A list of labels, values and disabled states.',
      },
      {
        property: 'optionType / buttonStyle',
        type: "'default' | 'button' / 'outline' | 'solid'",
        defaultValue: "'default' / 'outline'",
        description: 'Defines button-style presentation and the selected button surface.',
      },
      {
        property: 'orientation',
        type: "'horizontal' | 'vertical'",
        defaultValue: "'horizontal'",
        description: 'Native group orientation.',
      },
      {
        property: 'size',
        type: "'small' | 'medium' | 'large'",
        defaultValue: "'medium'",
        description: 'Button-style Radio.Group size; it is not a prop on a single Radio.',
      },
      {
        property: 'name / disabled',
        type: 'string / boolean',
        defaultValue: '— / false',
        description: 'Native group identity and availability.',
      },
    ],
    accessibility: [
      'Name the group and keep option labels visible. Use Checkbox for independent selections.',
      'Preserve arrow-key navigation and Space to select.',
      'Do not indicate selection with color alone. Button presentation must preserve radio semantics.',
    ],
    notes: [
      'Native size belongs to Radio.Group, not to a single Radio.',
      'Web segmented selection uses AntD Segmented: one pill wrapper, a shared background and the native moving selection surface. It uses a symmetric 320 ms easeInOutCubic transition; reduced motion disables movement.',
      'Circle Radio uses 32/40/50 px diameters with a separate label hit area of at least 48 px. The selected label underline follows the radio color, theme and hover state. A separate single-edge indicator shows keyboard focus.',
      'Form.Item binds Radio.Group through the regular value field; valuePropName="checked" is unnecessary.',
    ],
  },
  {
    slug: 'switch',
    title: 'Switch',
    summary: 'Represents an on/off setting with a clear effect.',
    antdComponent: 'Switch',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/switch/',
    whenToUse: [
      'When the setting state and the effect of changing it are clear to the user.',
      'Checkbox may be more appropriate for independent consent submitted at the end of a form.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Controlled setting',
        description:
          'onChange provides a boolean directly; its signature differs from a Checkbox event.',
        code: `import { useState } from 'react';
import { Switch } from 'antd';

export default function BasicSwitch() {
  const [enabled, setEnabled] = useState(true);
  return (
    <div>
      <label htmlFor="live-preview">Live preview</label>{' '}
      <Switch id="live-preview" checked={enabled} onChange={setEnabled} />
    </div>
  );
}`,
      },
      {
        id: 'sizes',
        title: 'Size and status text',
        description:
          'Native sizes are small and medium. Visible status text complements the external label.',
        code: `import { Space, Switch } from 'antd';

export default function SwitchSizes() {
  return (
    <Space orientation="vertical">
      <div>
        <label htmlFor="small-switch">Compact appearance</label>{' '}
        <Switch id="small-switch" size="small" defaultChecked />
      </div>
      <div>
        <label htmlFor="medium-switch">Notifications</label>{' '}
        <Switch id="medium-switch" size="medium" checkedChildren="On" unCheckedChildren="Off" defaultChecked />
      </div>
    </Space>
  );
}`,
      },
      {
        id: 'states',
        title: 'Loading, disabled and required on',
        description:
          'A required-on setting cannot be turned off. Loading represents a setting awaiting a result. This static demonstration does not save data or make network requests.',
        code: `import { Space, Switch } from 'antd';

export default function SwitchStates() {
  return (
    <Space orientation="vertical">
      <div><label htmlFor="pending-switch">Updating</label>{' '}<Switch id="pending-switch" loading checked /></div>
      <div><label htmlFor="disabled-on">Required on</label>{' '}<Switch id="disabled-on" disabled checked /></div>
      <div><label htmlFor="disabled-off">Locked off setting</label>{' '}<Switch id="disabled-off" disabled checked={false} /></div>
    </Space>
  );
}`,
      },
    ],
    api: [
      {
        property: 'checked / defaultChecked',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Controlled on/off state or initial value.',
      },
      {
        property: 'onChange',
        type: '(checked: boolean, event) => void',
        defaultValue: '—',
        description: 'Provides the new state directly as a boolean.',
      },
      {
        property: 'size',
        type: "'small' | 'medium'",
        defaultValue: "'medium'",
        description: 'Native size contract. large is unsupported.',
      },
      {
        property: 'loading / disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Pending operation indicator or disabled interaction.',
      },
      {
        property: 'checkedChildren / unCheckedChildren',
        type: 'ReactNode',
        defaultValue: '—',
        description: 'Status content inside the control; it does not replace the external label.',
      },
      {
        property: 'id',
        type: 'string',
        defaultValue: '—',
        description: 'Control identity used to associate a visible label.',
      },
    ],
    accessibility: [
      'Keep the setting name unchanged in both states. Describe the state separately.',
      'Preserve keyboard and touch behavior. A smaller presentation must not reduce the interaction area.',
      'If an update fails, restore the previous value and show an error according to the actual operation result.',
    ],
    notes: [
      'Use valuePropName="checked" inside Form.Item.',
      'Combine checked and disabled for a required-on setting. Users cannot turn it off with mouse, touch or keyboard. The visible label explains the requirement.',
      'Use medium in new examples because the native default size name is deprecated.',
      'Shared sm/md/lg Switch tracks are 32/40/50 px high and twice as wide. The thumb is 80% of the track height with a 10% inset at each end. Content variants reserve extra width without reducing text size.',
      'On and off hover states use opacity and the shared shadow. Track and handle use symmetric 320 ms easeInOutCubic transitions; reduced motion disables them.',
    ],
  },
  {
    slug: 'slider',
    title: 'Slider',
    summary:
      'Chooses a value or interval with radio-sized handles. Horizontal, range, numeric, vertical and reversed controls share one GenUX master.',
    antdComponent: 'Slider · InputNumber',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/slider/',
    whenToUse: [
      'For a bounded numeric value or interval where the relative position helps the choice.',
      'Pair the slider with InputNumber when users need to enter an exact integer or decimal.',
    ],
    examples: [
      {
        id: 'linear-range',
        title: 'Linear and range',
        description:
          'A single handle uses a number; a range uses an array and distinct accessible names for its bounds.',
        code: `import { useState } from 'react';
import GenUXSlider from '../src/react/GenUXSlider';

export default function LinearAndRange() {
  const [value, setValue] = useState(40);
  const [range, setRange] = useState<number[]>([20, 80]);
  return <>
    <GenUXSlider value={value} onChange={setValue} ariaLabelForHandle="Volume" />
    <GenUXSlider range value={range} onChange={setRange}
      ariaLabelForHandle={['Minimum volume', 'Maximum volume']} />
  </>;
}`,
      },
      {
        id: 'number',
        title: 'Synchronized number entry',
        description:
          'Valid step-aligned values update immediately. Off-step numbers stay as drafts until Enter or blur applies precision.',
        code: `import { useState } from 'react';
import { InputNumber } from 'antd';
import GenUXSlider from '../src/react/GenUXSlider';

export default function PreciseValue() {
  const [value, setValue] = useState(0.47);
  return <>
    <GenUXSlider min={0} max={1} step={0.01} value={value}
      onChange={setValue} ariaLabelForHandle="Opacity" />
    <label htmlFor="opacity-number">Opacity</label>
    <InputNumber id="opacity-number" min={0} max={1} step={0.01} precision={2}
      value={value} onChange={next => {
        if (next !== null && Number.isFinite(next) && next === Number(next.toFixed(2))) setValue(next);
      }} />
  </>;
}`,
      },
      {
        id: 'vertical-reverse',
        title: 'Vertical and reverse',
        description:
          'Orientation and reverse change presentation without changing the value model. Give vertical controls a container with an explicit height.',
        code: `import { useRef } from 'react';
import type { SliderRef } from 'antd';
import GenUXSlider from '../src/react/GenUXSlider';

export default function Directions() {
  const slider = useRef<SliderRef>(null);
  return <>
    <div className="slider-demo-vertical-frame">
      <GenUXSlider orientation="vertical" defaultValue={30}
        ariaLabelForHandle="Vertical level" />
    </div>
    <GenUXSlider ref={slider} reverse defaultValue={40}
      ariaLabelForHandle="Reversed level" />
  </>;
}`,
      },
    ],
    apiDescription:
      'GenUXSlider forwards the installed Ant Design single/range props and ref. Common root props and semantic classNames/styles pass through; GenUX owns the shared visual and motion rules.',
    api: [
      {
        property: 'value / defaultValue',
        type: 'number | number[]',
        defaultValue: '0 / [0, 0]',
        description: 'Controlled or initial value; range mode uses an array.',
      },
      {
        property: 'range',
        type: 'boolean | SliderRange',
        defaultValue: 'false',
        description: 'Enables multiple handles with native range behavior.',
      },
      {
        property: 'min / max / step',
        type: 'number / number / number | null',
        defaultValue: '0 / 100 / 1',
        description: 'Bounds and increment; null step selects only marks and endpoints.',
      },
      {
        property: 'orientation / reverse',
        type: "'horizontal' | 'vertical' / boolean",
        defaultValue: 'horizontal / false',
        description: 'Axis and direction; preserve the same value and callbacks.',
      },
      {
        property: 'disabled / keyboard',
        type: 'boolean | boolean[] / boolean',
        defaultValue: 'false / true',
        description:
          'Native availability and keyboard support; disabled controls retain their values.',
      },
      {
        property: 'onChange / onChangeComplete',
        type: '(value: number | number[]) => void',
        defaultValue: '—',
        description: 'Immediate value updates and a separate pointer/key completion callback.',
      },
      {
        property: 'ariaLabelForHandle / ariaValueTextFormatterForHandle',
        type: 'string | string[] / formatter | formatter[]',
        defaultValue: '—',
        description: 'Give each handle a meaningful name and readable value text.',
      },
      {
        property: 'className / rootClassName / style',
        type: 'string / string / CSSProperties',
        defaultValue: '—',
        description: 'Native common root props pass through alongside the required GenUX class.',
      },
      {
        property: 'classNames / styles / tooltip',
        type: 'native semantic maps / SliderTooltipProps',
        defaultValue: '—',
        description:
          'Native semantic customization and tooltip settings; preserve focus, sizing and motion contracts.',
      },
      {
        property: 'ref',
        type: 'React.Ref<SliderRef>',
        defaultValue: '—',
        description: 'Forwards the native focus and blur methods.',
      },
    ],
    accessibility: [
      'Name each range handle separately. Use value text to explain units instead of relying on color or tooltip visibility.',
      'Keep keyboard input enabled: arrow keys adjust values and Home/End reach the bounds. Reversed and vertical controls retain native direction behavior.',
      'Handles match the Radio visual size while reserving a separate stable interaction area. Keyboard focus uses one bottom marker without a surrounding ring.',
      'Numeric inputs offer an exact-entry alternative. Readable labels and values remain at least 14px at 320 CSS px.',
    ],
    notes: [
      'One GenUXSlider master is shared by this page and the color system. Its stylesheet loads only on routes that use it.',
      'Values and ARIA update immediately; presentation uses the central symmetric easing and honors reduced motion.',
      'This page uses Ant Design 6.6.6 public APIs. The legacy vertical prop remains supported; orientation is used in these examples.',
      'Storybook and previously approved component decisions are unchanged. Browser and physical-device acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'accordion',
    title: 'Accordion',
    summary:
      'Organizes content under expandable headings. Ant Design calls it Collapse; accordion is the single-open-panel mode.',
    antdComponent: 'Collapse',
    category: 'Content',
    sourceUrl: 'https://ant.design/components/collapse/',
    whenToUse: [
      'To keep long content scannable by revealing secondary details when needed.',
      'Use accordion to show one topic at a time, or multiple open panels for content that needs comparison.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Single open panel',
        description:
          'Uses the items data contract and accordion mode. This new component is experimental.',
        code: `import { Collapse } from 'antd';
import type { CollapseProps } from 'antd';
import { toggleCollapseOnSpace } from '../src/react/keyboard';

const items: CollapseProps['items'] = [
  { key: 'design', label: 'Design approach', children: <p>Flat 2.0: flat surfaces and restrained depth.</p> },
  { key: 'usage', label: 'Usage', children: <p>Open the relevant details from their heading.</p> },
];

export default function BasicAccordion() {
  return (
    <div onKeyDownCapture={toggleCollapseOnSpace}>
      <Collapse accordion defaultActiveKey="design" items={items} />
    </div>
  );
}`,
      },
      {
        id: 'multiple',
        title: 'Multiple open panels',
        description:
          'Independent headings can stay open together. Ghost is an experimental presentation that reduces unnecessary outer borders.',
        code: `import { Collapse } from 'antd';
import { toggleCollapseOnSpace } from '../src/react/keyboard';

export default function MultiplePanels() {
  return (
    <div onKeyDownCapture={toggleCollapseOnSpace}>
      <Collapse
        ghost
        defaultActiveKey={['keyboard', 'touch']}
        expandIconPlacement="end"
        items={[
          { key: 'keyboard', label: 'Keyboard', children: <p>Find the heading with Tab, then open it with Enter or Space.</p> },
          { key: 'touch', label: 'Touch', children: <p>The heading row provides the touch target.</p> },
        ]}
      />
    </div>
  );
}`,
      },
      {
        id: 'states',
        title: 'Controlled and disabled panels',
        description:
          'The open panel key lives in state. Visible text explains why a panel is disabled.',
        code: `import { useState } from 'react';
import { Collapse } from 'antd';
import { toggleCollapseOnSpace } from '../src/react/keyboard';

export default function AccordionStates() {
  const [active, setActive] = useState<string[]>(['available']);
  return (
    <div onKeyDownCapture={toggleCollapseOnSpace}>
      <Collapse
        activeKey={active}
        onChange={setActive}
        bordered={false}
        items={[
          { key: 'available', label: 'Available details', children: <p>The user controls this panel.</p> },
          { key: 'unavailable', label: 'Not available yet', collapsible: 'disabled', children: <p>This content is currently unavailable.</p> },
        ]}
      />
    </div>
  );
}`,
      },
    ],
    api: [
      {
        property: 'items',
        type: 'CollapseProps["items"]',
        defaultValue: '—',
        description: 'Data list containing key, label, children and panel-level collapsible.',
      },
      {
        property: 'accordion',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Keeps only one panel open at a time.',
      },
      {
        property: 'activeKey / defaultActiveKey',
        type: 'string | number | (string | number)[]',
        defaultValue: '—',
        description: 'Controlled open panels or initial keys.',
      },
      {
        property: 'onChange',
        type: '(key: string[]) => void',
        defaultValue: '—',
        description: 'Provides the open panel keys.',
      },
      {
        property: 'ghost / bordered',
        type: 'boolean',
        defaultValue: 'false / true',
        description: 'Transparent surface and outer border options.',
      },
      {
        property: 'expandIconPlacement',
        type: "'start' | 'end'",
        defaultValue: "'start'",
        description: 'Position of the expand indicator within the heading.',
      },
      {
        property: 'destroyOnHidden',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Removes closed panel content; local state and form input may be lost.',
      },
    ],
    accessibility: [
      'Write descriptive headings matching the content hierarchy. Preserve the trigger expanded relationship.',
      'Verify Enter/Space to toggle, Tab navigation and visible non-surrounding focus.',
      'Do not hide required errors or critical actions inside a closed panel users cannot find.',
    ],
    notes: [
      'Accordion, surface, icon placement and density options remain experimental and are excluded from decisions.',
      'Use items instead of deprecated Collapse.Panel, and destroyOnHidden instead of destroyInactivePanel.',
      'Space support for Ant Design 6.6.6 Collapse headings is provided by toggleCollapseOnSpace in docs/src/react/keyboard.ts, scoped to those headings. Native Enter and inner control key behavior are preserved.',
      'Helper import paths in snippets target the verification files. Outside this project, copy keyboard.ts and adjust its import path for your component.',
      'Assess potential data loss before changing default content preservation in panels containing forms.',
    ],
  },
  {
    slug: 'form',
    title: 'Form',
    summary:
      'Manages labels, field values, validation and submission in one contract. Submission results in these examples stay local.',
    antdComponent: 'Form · Form.Item',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/form/',
    whenToUse: [
      'To validate related fields and submit them as one value model.',
      'To associate error descriptions, required fields and control labels consistently.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Local submission',
        description:
          'onFinish runs only after validation succeeds. The example displays values locally without saving to a server.',
        code: `import { useState } from 'react';
import { Button, Form, Input } from 'antd';
import type { FormProps } from 'antd';

type Values = { name: string; email: string };

export default function BasicForm() {
  const [submitted, setSubmitted] = useState<Values | null>(null);
  const onFinish: FormProps<Values>['onFinish'] = (values) => setSubmitted(values);
  return (
    <>
      <Form<Values> name="profile" layout="vertical" variant="filled" onFinish={onFinish} scrollToFirstError={{ focus: true }}>
        <Form.Item name="name" label="Your name" rules={[{ required: true, message: 'Enter your name.' }]}>
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter a valid email address.' }]}>
          <Input type="email" autoComplete="email" />
        </Form.Item>
        <Button className="genux-button" type="primary" htmlType="submit">Preview</Button>
      </Form>
      <p role="status">{submitted ? submitted.name + ' has a local preview ready.' : ''}</p>
    </>
  );
}`,
      },
      {
        id: 'validation',
        title: 'Validation and field dependencies',
        description:
          'The confirmation password follows the first field. Error text describes a clear issue the user can correct.',
        code: `import { Button, Form, Input } from 'antd';

export default function ValidationForm() {
  return (
    <Form name="password-example" layout="vertical" variant="filled">
      <Form.Item name="password" label="New password" rules={[{ required: true, min: 8, message: 'Enter at least 8 characters.' }]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="confirm"
        label="Confirm password"
        dependencies={['password']}
        rules={[
          { required: true, message: 'Enter the password again.' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              return !value || getFieldValue('password') === value
                ? Promise.resolve()
                : Promise.reject(new Error('Passwords do not match.'));
            },
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button className="genux-button" htmlType="submit">Validate</Button>
    </Form>
  );
}`,
      },
      {
        id: 'preferences',
        title: 'Binding selection controls',
        description:
          'Checkbox and Switch bind through checked. Radio.Group and Select use the regular value contract.',
        code: `import { Button, Checkbox, Form, Radio, Select, Switch } from 'antd';

export default function PreferencesForm() {
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      name="preferences"
      layout="vertical"
      variant="filled"
      initialValues={{ notifications: true, digest: false, frequency: 'daily', city: 'istanbul' }}
    >
      <Form.Item name="city" label="City">
        <Select options={[{ value: 'istanbul', label: 'Istanbul' }, { value: 'ankara', label: 'Ankara' }]} />
      </Form.Item>
      <Form.Item name="frequency" label="Frequency">
        <Radio.Group options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />
      </Form.Item>
      <Form.Item name="notifications" label="Notifications" valuePropName="checked"><Switch /></Form.Item>
      <Form.Item name="digest" valuePropName="checked"><Checkbox>Receive digest emails</Checkbox></Form.Item>
      <Button className="genux-button" htmlType="button" onClick={() => form.resetFields()}>Reset to initial values</Button>
    </Form>
  );
}`,
      },
    ],
    api: [
      {
        property: 'layout',
        type: "'vertical' | 'horizontal' | 'inline'",
        defaultValue: "'horizontal'",
        description: 'Label and field layout. Start with vertical layout on narrow screens.',
      },
      {
        property: 'form',
        type: 'FormInstance<Values>',
        defaultValue: 'Created automatically',
        description: 'Value, error and reset API created with Form.useForm.',
      },
      {
        property: 'initialValues',
        type: 'Values',
        defaultValue: '—',
        description: 'Initial and reset values. Use setFieldsValue for later changes.',
      },
      {
        property: 'onFinish / onFinishFailed',
        type: 'Success / validation failure callbacks',
        defaultValue: '—',
        description:
          'Reports client validation results; it does not mean data was saved successfully on a server.',
      },
      {
        property: 'Form.Item.name / rules',
        type: 'NamePath / Rule[]',
        defaultValue: '—',
        description: 'Binds the field to the model and defines validation rules.',
      },
      {
        property: 'Form.Item.valuePropName',
        type: 'string',
        defaultValue: "'value'",
        description: 'Use checked for Checkbox and Switch.',
      },
      {
        property: 'scrollToFirstError',
        type: 'boolean | ScrollFocusOptions',
        defaultValue: 'false',
        description: 'Helps locate the first error; focus moves focus to the related field.',
      },
      {
        property: 'disabled / variant',
        type: "boolean / 'filled'",
        defaultValue: 'false / filled (project)',
        description:
          'Passes shared availability and the default filled surface to supported Ant Design fields.',
      },
    ],
    accessibility: [
      'Preserve each field relationship with its label, error and help text. Do not explain requirements only through color or an asterisk.',
      'Make the first error discoverable when submission fails. Preserve valid values the user entered.',
      'Announce actual operation results through live status text. Manage repeat submissions and pending operations in application state.',
    ],
    notes: [
      'Form layouts and new examples are experimental. Server validation, authorization and persistence are outside these technical examples.',
      'Use initialValues instead of field defaultValue inside a named Form.Item. Keep a single owner for each field value.',
      'Do not nest form elements. A Form inside Drawer must have an independent, explicit submission relationship.',
    ],
  },
  {
    slug: 'drawer',
    title: 'Drawer',
    summary:
      'Opens secondary details or editing while preserving the main context. Opening, closing and focus return are controlled.',
    antdComponent: 'Drawer',
    category: 'Layers',
    sourceUrl: 'https://ant.design/components/drawer/',
    whenToUse: [
      'When a short detail or editing flow should preserve the main page context.',
      'Consider a separate page when content replaces the main task. Avoid forcing every detail into a drawer.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Controlled panel',
        description:
          'Native Drawer provides the title and closing behavior. The new surface is experimental.',
        code: `import { useState } from 'react';
import { Button, Drawer } from 'antd';

export default function BasicDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="genux-button" onClick={() => setOpen(true)}>Open details</Button>
      <Drawer
        title="Component details"
        open={open}
        onClose={() => setOpen(false)}
        focusable={{ trap: true, focusTriggerAfterClose: true }}
      >
        <p>Content is shown while preserving the main context.</p>
      </Drawer>
    </>
  );
}`,
      },
      {
        id: 'placements',
        title: 'Four placements',
        description:
          'Placement options share one state. Shared responsive styles constrain the usable panel area.',
        code: `import { useState } from 'react';
import { Button, Drawer, Space } from 'antd';
import type { DrawerProps } from 'antd';

type Placement = NonNullable<DrawerProps['placement']>;
const placements: Placement[] = ['left', 'right', 'top', 'bottom'];

export default function DrawerPlacements() {
  const [placement, setPlacement] = useState<Placement>('right');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Space wrap>
        {placements.map((direction) => (
          <Button className="genux-button" key={direction} onClick={() => { setPlacement(direction); setOpen(true); }}>
            {direction}
          </Button>
        ))}
      </Space>
      <Drawer title="Placement experiment" placement={placement} open={open} onClose={() => setOpen(false)}>
        <p>Placement: {placement}</p>
      </Drawer>
    </>
  );
}`,
      },
      {
        id: 'form',
        title: 'Form and footer actions',
        description:
          'The footer button connects through the HTML form identity. Closing preserves the draft; valid submission produces only a local preview.',
        code: `import { useState } from 'react';
import { Button, Drawer, Form, Input, Space } from 'antd';
import type { FormProps } from 'antd';

type Values = { title: string };

export default function FormDrawer() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const onFinish: FormProps<Values>['onFinish'] = (values) => {
    setSubmitted(values.title);
    setOpen(false);
  };
  return (
    <>
      <Button className="genux-button" onClick={() => setOpen(true)}>Edit draft</Button>
      <p role="status">{submitted ? 'Local preview: ' + submitted : ''}</p>
      <Drawer
        title="Draft"
        open={open}
        onClose={() => setOpen(false)}
        destroyOnHidden={false}
        footer={
          <Space wrap>
            <Button className="genux-button" onClick={() => setOpen(false)}>Close</Button>
            <Button className="genux-button" type="primary" htmlType="submit" form="drawer-draft">Preview</Button>
          </Space>
        }
      >
        <Form<Values> id="drawer-draft" name="drawer-draft" layout="vertical" onFinish={onFinish}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Enter a title.' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}`,
      },
    ],
    api: [
      {
        property: 'open / onClose',
        type: 'boolean / DrawerProps["onClose"]',
        defaultValue: 'false / —',
        description: 'Panel visibility and close request. The state owner updates the open state.',
      },
      {
        property: 'title',
        type: 'ReactNode',
        defaultValue: '—',
        description: 'Visible and accessible panel title.',
      },
      {
        property: 'placement',
        type: "'left' | 'right' | 'top' | 'bottom'",
        defaultValue: "'right'",
        description: 'Direction from which the panel opens.',
      },
      {
        property: 'size',
        type: "'default' | 'large' | number | string",
        defaultValue: "'default'",
        description:
          'Width of a side panel or height of a vertical panel. The theme preserves narrow-screen limits.',
      },
      {
        property: 'footer / extra',
        type: 'ReactNode',
        defaultValue: '—',
        description: 'Footer actions and extra heading content.',
      },
      {
        property: 'destroyOnHidden',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Removes closed panel content and affects draft state.',
      },
      {
        property: 'focusable',
        type: '{ trap?: boolean; focusTriggerAfterClose?: boolean }',
        defaultValue: 'Native behavior',
        description: 'Manages the focus boundary and return to the trigger after closing.',
      },
      {
        property: 'loading / afterOpenChange',
        type: 'boolean / (open: boolean) => void',
        defaultValue: 'false / —',
        description:
          'Native content loading presentation and callback when the opening/closing transition completes.',
      },
    ],
    accessibility: [
      'Title the panel, manage keyboard focus inside it and return focus to the trigger when it closes.',
      'Preserve Escape and a visible close action. Do not rely only on touching the mask to close.',
      'Verify access to content and footer actions at 320 CSS px, short landscape heights and with the virtual keyboard open.',
    ],
    notes: [
      'New Drawer placements, surfaces and form flows are experimental and are not recorded as final decisions.',
      'Use destroyOnHidden instead of deprecated destroyOnClose, the v6 focusable contract and semantic styles/classNames slots.',
      'Examples do not make network requests or persist data. Draft deletion on close must be an explicit behavior in a real product.',
    ],
  },
  {
    slug: 'pill',
    title: 'Pill',
    summary:
      'Filled by default, with solid and outlined surfaces. Status, icon, removable and selectable labels share one Pill system.',
    antdComponent: 'Tag',
    category: 'Content',
    sourceUrl: 'https://ant.design/components/tag/',
    whenToUse: [
      'To display selected tags or short pieces of information.',
      'For removable tags with a clear action name and sufficient click area.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Basic Pill',
        description:
          'Minimum 32 px height, a surface that grows with content and shared Button radii.',
        code: `import GenUXPill from '../src/react/GenUXPill';
export default function BasicPill() { return <GenUXPill radius="pill" colorIndex={2}>Engineering</GenUXPill>; }`,
      },
      {
        id: 'closable',
        title: 'Removable tag',
        description: 'Phosphor X, native Tag keyboard behavior and a separate removal callback.',
        code: `import { useState } from 'react';
import GenUXPill from '../src/react/GenUXPill';
export default function ClosablePill() {
  const [visible, setVisible] = useState(true);
  return visible ? <GenUXPill closable onClose={() => setVisible(false)}>Design</GenUXPill> : null;
}`,
      },
      {
        id: 'surface',
        title: 'Surfaces and status',
        description: 'A semantic color works independently with all three native Tag variants.',
        code: `import GenUXPill from '../src/react/GenUXPill';
export default function StatusPills() { return <><GenUXPill color="success">Success</GenUXPill><GenUXPill color="success" variant="solid">Success</GenUXPill><GenUXPill color="success" variant="outlined">Success</GenUXPill></>; }`,
      },
      {
        id: 'checkable',
        title: 'Checkable tags with icon',
        description: 'A fully controlled selection with native checkbox semantics.',
        code: `import { useState } from 'react';
import { GenUXCheckablePill } from '../src/react/GenUXPill';
export default function SelectablePill() { const [checked, setChecked] = useState(true); return <GenUXCheckablePill checked={checked} onChange={setChecked}>Design</GenUXCheckablePill>; }`,
      },
      {
        id: 'automatic-colors',
        title: 'Automatic color distribution',
        description:
          'The Pill scope owns random, balanced assignments for a collection of stable raw keys.',
        code: `import GenUXPill, { GenUXPillColorScope } from '../src/react/GenUXPill';
const values = ['design', 'engineering', 'operations'];
export default function ColoredPills() { return <GenUXPillColorScope values={values}>{values.map(value => <GenUXPill key={value} colorKey={value}>{value}</GenUXPill>)}</GenUXPillColorScope>; }`,
      },
    ],
    api: [
      {
        property: 'colorKey / GenUXPillColorScope',
        type: 'string / values: readonly string[]',
        defaultValue: 'Opt in per collection',
        description:
          'Stable raw keys receive a random first color, then a different least-used color. Removing or reordering keys preserves surviving assignments; 17 families are reused only when needed.',
      },

      {
        property: 'variant',
        type: "'filled' | 'solid' | 'outlined'",
        defaultValue: "'filled'",
        description: 'Independent surface treatment for every color and semantic status.',
      },
      {
        property: 'color',
        type: 'TagProps[color]',
        defaultValue: 'Current theme primary',
        description:
          'Native semantic status, named preset or custom HEX seed. Explicit colors override colorIndex.',
      },
      {
        property: 'size',
        type: "'sm' | 'md' | 'lg'",
        defaultValue: 'Inherited profile',
        description:
          'Documentation label heights are 32/40/48 px; close targets retain their independent 32 px or 44 px floor.',
      },
      {
        property: 'icon / styles / classNames',
        type: 'TagProps',
        defaultValue: 'undefined',
        description:
          'Leading React icon and native root, icon, content and close semantic slots; object and function forms are supported.',
      },
      {
        property: 'GenUXCheckablePill',
        type: 'checked / onChange / disabled',
        defaultValue: 'Controlled',
        description:
          'Native checkbox semantics with click and Space activation. Selection and removal are separate patterns.',
      },

      {
        property: 'colorIndex',
        type: 'number',
        defaultValue: 'undefined',
        description:
          'Optional stable palette assignment. Explicit color takes precedence; without either, filled inherits the current color scheme.',
      },
      {
        property: 'radius',
        type: "'0' | '3' | '5' | 'pill'",
        defaultValue: "'5'",
        description: 'Shares the Button radius decisions; pill is fully rounded.',
      },
      {
        property: 'closable / onClose',
        type: 'boolean / TagProps[onClose]',
        defaultValue: 'false / undefined',
        description: 'Native Tag closing behavior; preventDefault cancels closing.',
      },
      {
        property: 'closeLabel / disabled',
        type: 'string / boolean',
        defaultValue: 'Derived from label / false',
        description: 'Accessible name and availability of the removal action.',
      },
    ],
    accessibility: [
      'Minimum 14px documentation text in Outfit (default weight 400, minimum 300); long text wraps naturally.',
      'The X mark is a Phosphor SVG; its close target is 32 px for precise input and 44 px for touch.',
      'Focus returns to the native input after removing a Select tag.',
    ],
    notes: [
      'GenUXPill uses native Ant Design Tag. GenUXCheckablePill uses fully controlled native CheckableTag; Select composes the same master.',
      'The filled palette retains 75% white and 5% black. Solid and outlined use the same 17 chromatic families, with contrast-selected ink. Neutral presets and the duplicate red endpoint are excluded.',
      'Automatic collections allocate after client commit, preserving identical SSR/hydration fallback. Theme, locale and size do not recreate the allocator. Explicit semantic colors and fixed palette assignments take precedence.',
      'Pill is a web experiment and requires user approval before entering the Storybook decision list.',
    ],
  },
  {
    slug: 'dropdown',
    title: 'Dropdown',
    summary:
      'Keep secondary actions close and the next step clear. Explore a simple action menu, two surface treatments and an organized cascading menu.',
    antdComponent: 'Dropdown · Menu',
    category: 'Navigation',
    sourceUrl: 'https://ant.design/components/dropdown/',
    whenToUse: [
      'To keep related secondary actions beside their context without crowding the main flow.',
      'Use groups and one submenu when they make actions easier to find. Keep essential actions visible outside the menu.',
    ],
    examples: [
      {
        id: 'actions',
        title: 'Basic actions',
        description:
          'A named button opens an action menu. Each enabled choice reports one local outcome; unavailable choices cannot run.',
        code: `import { useState } from 'react';
import GenUXDropdown from '../src/react/GenUXDropdown';

export default function ActionMenu() {
  const [result, setResult] = useState('Choose an action');
  return <>
    <GenUXDropdown label="Workspace actions" items={[
      { key: 'note', label: 'Add review note' },
      { key: 'publish', label: 'Publish remotely', disabled: true },
      { type: 'divider' },
      { key: 'clear', label: 'Clear local notes', danger: true },
    ]} onAction={key => setResult(key === 'note' ? 'Local review note selected' : 'Local notes cleared')} />
    <p role="status">{result}</p>
  </>;
}`,
      },
      {
        id: 'object-styles',
        title: 'Quiet surface · object styles',
        description:
          'An object supplies native semantic classes and styles for a consistent quiet surface. The interaction contract stays the same.',
        code: `import GenUXDropdown from '../src/react/GenUXDropdown';

export default function QuietMenu() {
  return <GenUXDropdown label="Review tools" items={[{ key: 'review', label: 'Review notes' }]}
    onAction={() => {}}
    classNames={{ root: 'genux-dropdown-quiet', item: 'genux-dropdown-quiet-item' }}
    styles={{ root: { borderRadius: 'var(--radius)' }, itemTitle: { color: 'var(--ink)' } }} />;
}`,
      },
      {
        id: 'function-styles',
        title: 'Contextual surface · function styles',
        description:
          'A function reads native component props to resolve semantic styles as the menu opens and closes.',
        code: `import GenUXDropdown from '../src/react/GenUXDropdown';

export default function ContextualMenu() {
  return <GenUXDropdown label="Review options" items={[{ key: 'review', label: 'Review notes' }]}
    onAction={() => {}}
    classNames={({ props }) => ({ root: props.open ? 'genux-dropdown-context genux-dropdown-context-open' : 'genux-dropdown-context' })}
    styles={({ props }) => ({ root: { boxShadow: props.open ? 'var(--shadow-soft)' : 'var(--shadow-contact)' }, item: { borderRadius: 'var(--radius-sm)' } })} />;
}`,
      },
      {
        id: 'cascading',
        title: 'Cascading menu',
        description:
          'Groups give the menu a reading order. Submenus open by click or keyboard; unavailable branches remain disabled.',
        code: `import GenUXDropdown from '../src/react/GenUXDropdown';

export default function OrganizeMenu() {
  return <GenUXDropdown label="Organize workspace" onAction={() => {}} items={[
    { type: 'group', key: 'workspace', label: 'Workspace', children: [
      { key: 'move', label: 'Move to folder', children: [{ key: 'planning', label: 'Planning' }, { key: 'delivery', label: 'Delivery' }] },
      { key: 'access', label: 'Access settings', disabled: true, children: [{ key: 'permissions', label: 'Manage access' }] },
    ] },
    { type: 'divider' },
    { key: 'reset', label: 'Reset local organization', danger: true },
  ]} />;
}`,
      },
    ],
    apiDescription:
      'GenUXDropdown adds a named keyboard trigger, native menu focus and one explicit action callback to the installed Dropdown and Menu.',
    api: [
      {
        property: 'label',
        type: 'string',
        defaultValue: 'Required',
        description: 'Visible trigger label and accessible menu name.',
      },
      {
        property: 'items',
        type: "NonNullable<MenuProps['items']>",
        defaultValue: 'Required',
        description: 'Native action items, groups, dividers, disabled choices and submenus.',
      },
      {
        property: 'onAction',
        type: '(key: string) => void',
        defaultValue: 'Required',
        description:
          'Called once for an enabled leaf action. The consumer owns its outcome and any confirmation.',
      },
      {
        property: 'classNames / styles',
        type: "DropdownProps['classNames'] / DropdownProps['styles']",
        defaultValue: 'Shared GenUX skin',
        description:
          'Native semantic object or function styling. Shared accessibility and popup ownership remain intact.',
      },
    ],
    nativeApi: [
      {
        property: 'trigger / open / onOpenChange',
        type: 'click / boolean / callback',
        defaultValue: 'Managed by GenUX',
        description:
          'Click and keyboard opening share the same popup state. Closing returns keyboard focus immediately.',
      },
      {
        property: 'menu',
        type: 'MenuProps',
        defaultValue: 'Native Menu',
        description:
          'Native arrow navigation, groups and submenus; the wrapper retains focus and disabled behavior.',
      },
      {
        property: 'classNames / styles',
        type: 'semantic object | function',
        defaultValue: '—',
        description:
          'The two surface examples exercise the actual native object and function APIs.',
      },
    ],
    accessibility: [
      'Use Enter, Space or ArrowDown to open the menu. Arrow keys move through choices; Escape returns to the trigger.',
      'Submenus support click and keyboard Right/Left navigation. Disabled actions and branches cannot execute.',
      'Menu panels stay within the available viewport and scroll inside. Focus uses one visible edge marker.',
    ],
    notes: [
      'All examples have local outcomes. They do not sign out an account, publish data or call a server.',
      'The page separates action hierarchy from surface styling and nested organization. Shared tokens own text, target sizes and motion.',
    ],
  },
  {
    slug: 'pagination',
    title: 'Pagination',
    summary:
      'Keep your place in a long collection. Move between pages, change the page size and jump directly to a known page with shared GenUX controls.',
    antdComponent: 'Button · Select · Input',
    category: 'Navigation',
    sourceUrl: 'https://ant.design/components/pagination/',
    whenToUse: [
      'For a bounded collection whose total and current page are known.',
      'Keep pagination beside the collection it controls. Use the range and total to explain which records are visible.',
      'Choose from the existing Solid, Outline, Pastel-filled, Text button and Link surfaces to fit the action hierarchy.',
    ],
    examples: [
      {
        id: 'controlled',
        title: 'Explore pages',
        description:
          'The page owns current and pageSize. One callback handles page navigation, size changes and direct jumps; the default controls include the range and total.',
        code: `import { useState } from 'react';
import GenUXPagination from '../src/react/GenUXPagination';

export default function ReviewPages() {
  const [current, setCurrent] = useState(42);
  const [pageSize, setPageSize] = useState(10);
  return <GenUXPagination
    label="Order review pages"
    current={current}
    total={500}
    pageSize={pageSize}
    onChange={(page, size) => { setCurrent(page); setPageSize(size); }}
  />;
}`,
      },
      {
        id: 'boundaries',
        title: 'Page boundaries',
        description:
          'A short result keeps one readable page. First, previous, next and last actions cannot move beyond the available range.',
        code: `import GenUXPagination from '../src/react/GenUXPagination';

export default function SinglePage() {
  return <GenUXPagination
    label="Single page results"
    current={1}
    total={8}
    pageSize={10}
    onChange={() => {}}
    showSizeChanger={false}
    showQuickJumper={false}
  />;
}`,
      },
      {
        id: 'button-surfaces',
        title: 'Button surfaces',
        description:
          'The five approved Button surfaces come from the shared decision model. Ordinary buttons and the active page can use independent surfaces; each example owns its current page.',
        code: `import { useState } from 'react';
import GenUXPagination, { type GenUXPaginationProps } from '../src/react/GenUXPagination';
import genux from '../src/data/genux.json';

type Surface = NonNullable<GenUXPaginationProps['buttonType']>;

function SurfacePages({ surface }: { surface: Surface }) {
  const [current, setCurrent] = useState(4);
  return <GenUXPagination
    current={current}
    total={80}
    pageSize={10}
    onChange={setCurrent}
    buttonType={surface}
    activeButtonType={surface}
    showTotal={false}
    showSizeChanger={false}
    showQuickJumper={false}
  />;
}

export default function PaginationSurfaces() {
  return <div className="pattern-stack">
    {genux.decisions.buttons.fill_variants.map(surface => <section key={surface.value}>
      <h3>{surface.label}</h3>
      <SurfacePages surface={surface.value as Surface} />
    </section>)}
  </div>;
}`,
      },
      {
        id: 'availability',
        title: 'Availability',
        description:
          'Zero results and an explicitly disabled collection keep their range readable. Disabled page actions cannot invoke the callback.',
        code: `import GenUXPagination from '../src/react/GenUXPagination';

export default function UnavailablePages() {
  return <GenUXPagination
    label="Unavailable queue pages"
    current={2}
    total={30}
    pageSize={10}
    onChange={() => {}}
    showSizeChanger={false}
    showQuickJumper={false}
    disabled
  />;
}`,
      },
    ],
    apiDescription:
      'GenUXPagination composes shared GenUX buttons with native Select and Input controls. Its controlled API is separate from the installed Ant Design Pagination reference.',
    api: [
      {
        property: 'current',
        type: 'number',
        defaultValue: 'Required',
        description: 'One-based current page. The rendered page stays within the available range.',
      },
      {
        property: 'total',
        type: 'number',
        defaultValue: 'Required',
        description: 'Total record count. An empty result displays a zero range.',
      },
      {
        property: 'pageSize',
        type: 'number',
        defaultValue: 'Required',
        description: 'Records per page, controlled by the consumer.',
      },
      {
        property: 'onChange',
        type: '(page: number, pageSize: number) => void',
        defaultValue: 'Required',
        description:
          'Receives an enabled page, size or jump change. Update both controlled values in the consumer.',
      },
      {
        property: 'pageSizeOptions',
        type: 'readonly number[]',
        defaultValue: '[10, 20, 50]',
        description: 'Page sizes offered by the branded Select control.',
      },
      {
        property: 'showSizeChanger',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Shows the records-per-page control.',
      },
      {
        property: 'showQuickJumper',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Shows the page field and explicit jump action.',
      },
      {
        property: 'showTotal',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Shows the visible record range and total.',
      },
      {
        property: 'disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Disables page navigation, page size and direct jumps.',
      },
      {
        property: 'buttonType',
        type: "'solid' | 'outline' | 'tint' | 'text' | 'link'",
        defaultValue: "'text'",
        description:
          'Existing GenUXButton surface for direction buttons and ordinary page numbers.',
      },
      {
        property: 'activeButtonType',
        type: "'solid' | 'outline' | 'tint' | 'text' | 'link'",
        defaultValue: "'solid'",
        description: 'Existing GenUXButton surface for the current page and Go action.',
      },
      {
        property: 'label',
        type: 'string',
        defaultValue: 'Pagination',
        description: 'Accessible navigation name identifying the controlled collection.',
      },
    ],
    accessibility: [
      'Use Tab to reach page buttons, the size control and jump field. Activate buttons with Enter or Space.',
      'The selected page has aria-current=page. Named first, previous, next and last actions remain distinct.',
      'Keyboard focus uses the shared non-surrounding indicator. Disabled and boundary actions cannot change the page.',
      'Controls wrap within narrow containers while preserving readable text and the shared target sizes.',
    ],
    notes: [
      'The first two pages, last two pages and current page with its immediate neighbors remain visible; ellipses separate gaps.',
      'Pagination inherits the shared sm/md/lg component size profile. It has no separate size prop.',
      'The installed Ant Design 6.6.6 Pagination is an API reference. Explicit first and last actions belong to GenUXPagination; they are not native Pagination props.',
      'The example owns its page, page size and local review note. Presentation and language changes preserve that state.',
      'The current page keeps a separate single-edge marker across all five Button surfaces, including Text button and Link.',
    ],
  },
  {
    slug: 'steps',
    title: 'Steps',
    summary:
      'Make a sequence easy to follow. Show the current step, explain what comes next and keep completed work available when someone goes back.',
    antdComponent: 'Steps · Button · Input',
    category: 'Navigation',
    sourceUrl: 'https://ant.design/components/steps/',
    whenToUse: [
      'For a task with a meaningful order, such as setup, review or approval.',
      'Use short titles and useful descriptions. Keep the current task and its next action beside the progress indicator.',
      'Use clickable steps only when people can safely revisit them. Explain unavailable steps and preserve entered information.',
    ],
    examples: [
      {
        id: 'guided',
        title: 'Guided setup',
        description:
          'The consumer owns the current step. Back and Continue change the local sequence within its bounds.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXSteps from '../src/react/GenUXSteps';
import GenUXButton from '../src/react/GenUXButton';
import '../src/styles/genux-steps.css';
const items = [{ key: 'details', title: 'Details', content: 'Name and purpose' }, { key: 'review', title: 'Review', content: 'Check the details' }, { key: 'ready', title: 'Ready', content: 'Confirm your choice' }];
export default function GuidedSteps() {
  const [current, setCurrent] = useState(0);
  return <GenUXProvider appearance="docs"><GenUXSteps label="Setup progress" items={items} current={current} />
    <GenUXButton text="Back" fill="text" disabled={current === 0} onClick={() => setCurrent(value => value - 1)} />
    <GenUXButton text="Continue" disabled={current === 2} onClick={() => setCurrent(value => value + 1)} />
  </GenUXProvider>;
}`,
      },
      {
        id: 'presentation',
        title: 'Layouts and markers',
        description:
          'Numbered, icon and outlined markers use the same native Steps. Auto layout stacks in narrow containers; Vertical keeps a checklist stacked.',
        code: `import GenUXProvider from '../src/react/GenUXProvider';
import GenUXSteps from '../src/react/GenUXSteps';
import GenUXIcon from '../src/react/GenUXIcon';
import '../src/styles/genux-steps.css';
export default function IconSteps() {
  return <GenUXProvider appearance="docs"><GenUXSteps label="Review checklist" current={1} orientation="vertical" variant="outlined" items={[
    { key: 'details', title: 'Details', icon: <GenUXIcon name="house" /> },
    { key: 'review', title: 'Review', icon: <GenUXIcon name="search" /> },
    { key: 'ready', title: 'Ready', icon: <GenUXIcon name="check" /> },
  ]} /></GenUXProvider>;
}`,
      },
      {
        id: 'recovery',
        title: 'States and recovery',
        description:
          'An error identifies the current issue and an explicit action lets the consumer recover. Changing presentation never implies a successful operation.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXSteps from '../src/react/GenUXSteps';
import GenUXButton from '../src/react/GenUXButton';
import '../src/styles/genux-steps.css';
export default function StepRecovery() {
  const [issue, setIssue] = useState(true);
  return <GenUXProvider appearance="docs"><GenUXSteps label="Local review progress" current={1} status={issue ? 'error' : 'process'} items={[
    { key: 'details', title: 'Details', content: 'Name is available' },
    { key: 'review', title: 'Review', content: issue ? 'Confirmation is missing' : 'Review the confirmation' },
    { key: 'ready', title: 'Ready', content: 'Waiting for confirmation' },
  ]} /><GenUXButton text="Review locally" disabled={!issue} onClick={() => setIssue(false)} /></GenUXProvider>;
}`,
      },
      {
        id: 'navigation',
        title: 'Step navigation',
        description:
          'Controlled navigation allows revisiting available steps. Arrow keys move focus; Enter or Space chooses a step. Disabled steps remain explained.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXSteps from '../src/react/GenUXSteps';
import '../src/styles/genux-steps.css';
export default function StepNavigation() {
  const [current, setCurrent] = useState(0);
  return <GenUXProvider appearance="docs"><GenUXSteps label="Workspace sections" current={current} onChange={setCurrent} type="navigation" items={[
    { key: 'overview', title: 'Overview' },
    { key: 'members', title: 'Members' },
    { key: 'access', title: 'Access', content: 'Available after workspace creation', disabled: true },
  ]} /><p role="status">Current section: {current + 1}</p></GenUXProvider>;
}`,
      },
    ],
    apiDescription:
      'GenUXSteps wraps the installed native Steps. Container adaptation, shared sizes and keyboard focus are GenUX behavior; current remains controlled by the caller.',
    api: [
      {
        property: 'items',
        type: 'readonly GenUXStepItem[]',
        defaultValue: 'Required',
        description:
          'Stable keys, titles and optional content, Phosphor icon nodes, status and disabled state. Keep a logical sequence in a stable order.',
      },
      {
        property: 'current',
        type: 'number',
        defaultValue: 'Required',
        description: 'Zero-based current step, bounded to the available items.',
      },
      {
        property: 'onChange',
        type: '(index: number) => void',
        defaultValue: 'undefined',
        description:
          'Makes available steps interactive. The consumer decides whether a step change is valid and updates current.',
      },
      {
        property: 'status',
        type: "'wait' | 'process' | 'finish' | 'error'",
        defaultValue: "'process'",
        description: 'Current step status; a supplied item status takes precedence.',
      },
      {
        property: 'orientation',
        type: "'auto' | 'horizontal' | 'vertical'",
        defaultValue: "'auto'",
        description:
          'Auto measures the container and short viewport. Horizontal is a preferred wide layout and still stacks when the container is too narrow.',
      },
      {
        property: 'titlePlacement',
        type: "'horizontal' | 'vertical'",
        defaultValue: "'horizontal'",
        description:
          'Places labels beside or below markers when horizontal layout has enough space.',
      },
      {
        property: 'variant',
        type: "'filled' | 'outlined'",
        defaultValue: "'filled'",
        description: 'Native marker treatment with shared readable status colors.',
      },
      {
        property: 'type',
        type: "'default' | 'navigation'",
        defaultValue: "'default'",
        description: 'A progress sequence or revisitable navigation with one fixed selection edge.',
      },
      {
        property: 'label',
        type: 'string',
        defaultValue: 'Steps',
        description: 'Accessible name identifying the sequence.',
      },
      {
        property: 'disabled',
        type: 'boolean',
        defaultValue: 'false',
        description:
          'Prevents every step change. Inherits native ConfigProvider disabled state unless explicitly supplied.',
      },
    ],
    nativeApi: [
      {
        property: 'orientation',
        type: "'horizontal' | 'vertical'",
        defaultValue: "'horizontal'",
        description:
          'Native orientation. GenUX auto container layout is separate from the native viewport responsive behavior.',
      },
      {
        property: 'size',
        type: "'small' | 'medium'",
        defaultValue: "'medium'",
        description:
          'Native Steps supports two sizes. GenUX maps sm to small and md/lg to medium with shared marker geometry.',
      },
      {
        property: 'items.content',
        type: 'ReactNode',
        defaultValue: 'undefined',
        description:
          'Native step description. Prefer content over the deprecated description property.',
      },
    ],
    accessibility: [
      'The current step exposes aria-current=step. Text status distinguishes finished, current, waiting and error states without relying on color.',
      'Tab reaches available interactive steps. Arrows and Home/End move focus without changing selection; Enter and Space activate the focused step.',
      'Unavailable steps cannot activate and remain explained. Keyboard focus uses one immediate non-surrounding marker.',
      'Narrow containers stack steps without hiding titles, shrinking targets or duplicating the form. Back preserves entered information.',
    ],
    notes: [
      'These examples are local demonstrations. They do not create a workspace, contact a backend or represent a live operation.',
      'The shared sm/md/lg profile supplies 32/40/50px markers and at least 48/56/64px interactive targets. Native Steps has no large size prop.',
      'Auto layout starts vertical in SSR and measures the actual container after hydration. Short landscape viewports keep a stacked journey.',
      'Native 6.6.6 activation is retained. A bounded accessibility adapter supplies missing current/disabled semantics and focus navigation; vendor files are unchanged.',
    ],
  },
  {
    slug: 'breadcrumb',
    title: 'Breadcrumb',
    summary:
      'A readable path through the workspace. Move back through real links, jump to related pages and recognize your current location.',
    antdComponent: 'Breadcrumb · Dropdown · Menu',
    category: 'Navigation',
    sourceUrl: 'https://ant.design/components/breadcrumb/',
    whenToUse: [
      'To show the current page within a hierarchy and provide a reliable path back.',
      'Use sibling navigation when related pages are useful next steps. Keep the current page distinct from links.',
    ],
    examples: [
      {
        id: 'quick-navigation',
        title: 'Quick navigation',
        description:
          'An ancestor link and its adjacent menu have separate targets. The menu opens by click or keyboard and offers real destinations.',
        code: `import GenUXBreadcrumb from '../src/react/GenUXBreadcrumb';

export default function WorkspacePath() {
  return <GenUXBreadcrumb label="Workspace path" items={[
    { key: 'home', label: 'Overview', href: '/' },
    { key: 'workspace', label: 'Data workspace', href: '/components/record-workspace/', menuLabel: 'Navigate Data workspace pages', menu: [
      { key: 'data-table', label: 'Data table', href: '/components/data-table/' },
      { key: 'record-details', label: 'Record details', href: '/components/record-details/' },
    ] },
    { key: 'record-details', label: 'Record details' },
  ]} />;
}`,
      },
      {
        id: 'icon-style',
        title: 'Icon style',
        description:
          'The home shortcut has an accessible name. Other icons accompany visible text; the final item remains a non-link current page.',
        code: `import GenUXBreadcrumb from '../src/react/GenUXBreadcrumb';

export default function IconPath() {
  return <GenUXBreadcrumb label="Workspace path" items={[
    { key: 'home', label: 'Overview', href: '/', icon: 'house', iconOnly: true },
    { key: 'workspace', label: 'Record workspace', href: '/components/record-workspace/', icon: 'settings' },
    { key: 'record-details', label: 'Record details', icon: 'check' },
  ]} />;
}`,
      },
    ],
    apiDescription:
      'GenUXBreadcrumb composes the native Breadcrumb and Dropdown with explicit link, current-page and keyboard semantics.',
    api: [
      {
        property: 'label',
        type: 'string',
        defaultValue: 'Required',
        description:
          'Accessible navigation name that distinguishes the path from other navigation.',
      },
      {
        property: 'items',
        type: 'readonly GenUXBreadcrumbItem[]',
        defaultValue: 'Required',
        description:
          'Ordered stable keys and readable labels. The last item is the current page and never a link.',
      },
      {
        property: 'item.href',
        type: 'string',
        defaultValue: '—',
        description: 'Real destination for an ancestor. Current-page href is ignored.',
      },
      {
        property: 'item.icon / iconOnly',
        type: 'GenUXIconName / boolean',
        defaultValue: '— / false',
        description:
          'Shared Phosphor icon. Icon-only ancestors retain their text label as an accessible name.',
      },
      {
        property: 'item.menu / menuLabel',
        type: 'readonly GenUXBreadcrumbDestination[] / string',
        defaultValue: '— / item label',
        description:
          'Named sibling destinations opened by a separate native keyboard-operable button.',
      },
    ],
    nativeApi: [
      {
        property: 'Breadcrumb.items / itemRender',
        type: 'ItemType[] / function',
        defaultValue: '—',
        description:
          'Native ordered path. The adapter renders valid links, non-link current text and sibling controls.',
      },
      {
        property: 'Dropdown.open / onOpenChange',
        type: 'boolean / function',
        defaultValue: 'Controlled',
        description:
          'Native popup lifecycle with click activation, arrow navigation and immediate Escape focus return.',
      },
    ],
    accessibility: [
      'Use Tab to reach links and sibling controls. Enter, Space or ArrowDown opens the menu; Escape returns focus.',
      'Arrow keys move through native menu items. Enter or Space activates the selected destination exactly once.',
      'The current page has aria-current=page. Icons and separators are decorative; icon-only home keeps its accessible name.',
      'Paths wrap at narrow widths without reducing text size. Links and menu targets retain shared minimum dimensions.',
    ],
    notes: [
      'The two variants share one native component and the existing GenUX tokens, sizing, language and motion contracts.',
      'The example path describes a workspace context; its links lead to actual documentation routes.',
    ],
  },
  {
    slug: 'splitter',
    title: 'Splitter',
    summary:
      'Give related tasks their own space. Adaptive panels start stacked, expand side by side when space allows and retain selection, drafts and focus while resizing.',
    antdComponent: 'Splitter · Splitter.Panel',
    category: 'Layout',
    sourceUrl: 'https://ant.design/components/splitter/',
    whenToUse: [
      'For a collection and inspector, an editor and review, or two related tasks that benefit from adjustable space.',
      'Start with a stacked flow on narrow screens. Keep each panel readable and provide a non-drag way to resize.',
    ],
    examples: [
      {
        id: 'adaptive',
        title: 'Adaptive workspace panels',
        description:
          'GenUXSplitter owns panel proportions and native rendering. The page owns its records and draft; the same content stays mounted as the available space changes.',
        code: `import GenUXSplitter from '../src/react/GenUXSplitter';

export default function WorkspacePanels() {
  return <GenUXSplitter id="workspace-panels" label="Records and review" initialSizes={[60, 40]} panels={[
    { id: 'records-pane', label: 'Records', children: <p>Choose a record.</p> },
    { id: 'review-pane', label: 'Review', children: <p>Inspect the current record.</p> },
  ]} />;
}`,
      },
      {
        id: 'vertical',
        title: 'Vertical editor and review',
        description:
          'Use a vertical flow when tasks should stay above and below each other at every width. Panel buttons and keyboard arrows share the same bounded value as dragging.',
        code: `import GenUXSplitter from '../src/react/GenUXSplitter';

export default function EditorPanels() {
  return <GenUXSplitter id="editor-panels" label="Editor and review" orientation="vertical" panels={[
    { id: 'editor-pane', label: 'Editor', min: 25, children: <p>Edit the draft.</p> },
    { id: 'preview-pane', label: 'Preview', min: 25, children: <p>Review the draft.</p> },
  ]} />;
}`,
      },
    ],
    apiDescription:
      'GenUXSplitter is the accessible adaptive two-panel contract used by Data workspace pages. Native Ant Design supports additional panel arrangements; its underlying API is listed separately.',
    api: [
      {
        property: 'GenUXSplitter.panels',
        type: '[GenUXSplitterPanel, GenUXSplitterPanel]',
        defaultValue: 'Required',
        description:
          'Two stable IDs, accessible labels and caller-owned React content. Optional min/max values are percentages.',
      },
      {
        property: 'id / label',
        type: 'string / string',
        defaultValue: 'Required',
        description: 'Unique instance identity and visible accessible group name.',
      },
      {
        property: 'orientation',
        type: "'auto' | 'horizontal' | 'vertical'",
        defaultValue: 'auto',
        description:
          'Auto starts stacked and uses measured available space to choose side-by-side panels. Explicit values are intended for known container constraints.',
      },
      {
        property: 'initialSizes',
        type: '[number, number]',
        defaultValue: '[50, 50]',
        description:
          'Initial relative weights normalize into bounded percentages. Invalid values recover to a balanced split.',
      },
      {
        property: 'className',
        type: 'string',
        defaultValue: '—',
        description:
          'Adds a consumer class; shared tokens own grip geometry, spacing, focus and motion.',
      },
    ],
    nativeApi: [
      {
        property: 'orientation',
        type: "'horizontal' | 'vertical'",
        defaultValue: 'horizontal',
        description:
          'Native panel layout direction. The GenUX auto mode resolves this value from the container.',
      },
      {
        property: 'Splitter.Panel size / min / max',
        type: 'number | string',
        defaultValue: 'Automatic',
        description:
          'Native sizes support pixels or percentage strings. GenUX passes controlled bounded percentages.',
      },
      {
        property: 'onResize / onResizeEnd',
        type: '(sizes: number[]) => void',
        defaultValue: '—',
        description:
          'Native resize events expose panel pixel sizes. GenUX adds pointer cancellation, keyboard access and named non-drag actions.',
      },
      {
        property: 'collapsible / destroyOnHidden',
        type: 'object / boolean',
        defaultValue: 'Not enabled / false',
        description:
          'Optional native collapse lifecycle. The GenUX two-panel contract keeps both panes available and mounted.',
      },
    ],
    accessibility: [
      'Focus the named separator with Tab. Use the axis-appropriate arrow keys to resize; Home and End move to the allowed limits.',
      'Visible panel buttons provide a single-pointer alternative to dragging. Focus uses one non-surrounding edge marker.',
      'Each pane is a named keyboard-scrollable region. Panel content and focus remain mounted while the layout changes.',
      'The grip reserves its own space; its hit area is at least 32px, increasing for coarse input without covering content.',
    ],
    notes: [
      'Uses the installed native Ant Design Splitter and Panel without changing vendor source or approved component decisions.',
      'All five Data workspace pages share this adapter. Resizing changes presentation and never commits a record.',
      'Styles load only on Splitter and Data workspace routes. The mobile and desktop presentations share one mounted content tree.',
    ],
  },
  {
    slug: 'card',
    title: 'Card',
    summary:
      'Purpose-built cards for records, metrics and actions. Explore 23 card purposes, domain recipes and controlled interactions before opening the optional GenUX lab.',
    antdComponent: 'Card · GenUXCard · EntityCard · MetricCard · PurposeCard',
    category: 'Content',
    sourceUrl: 'https://ant.design/components/card/',
    whenToUse: [
      'Use EntityCard for a recognizable record and MetricCard for a value with its period and comparison.',
      'Choose a clear purpose and useful content. A task workspace may combine a table, form, chart and related actions; arrange peer cards as siblings.',
      'Use serializable card definitions for trusted rendering and validated GenUX intents; keep data access, queries and mutation in the Frappe host.',
    ],
    examples: [
      {
        id: 'entity',
        title: 'A record with a clear next action',
        description:
          'EntityCard renders a serializable record model. Its action returns the model to the host instead of assuming navigation or persistence.',
        code: `import { EntityCard } from '../src/react/cards';
import type { GenUXCardModel } from '../src/data/card-model';
const model: GenUXCardModel = { id: 'ORDER-24', kind: 'entity', title: 'Workspace review', facts: [{ key: 'amount', label: 'Amount', value: 0, format: 'currency', currency: 'EUR' }], primaryAction: { id: 'inspect', label: 'Open review', intent: 'inspect' } };
export default function RecordCard({ onInspect }: { onInspect: (model: GenUXCardModel) => void }) {
  return <EntityCard model={model} onAction={(_action, selected) => onInspect(selected)} />;
}`,
      },
      {
        id: 'metric',
        title: 'A metric with context',
        description:
          'A number needs a period and a comparison. Favorable and unfavorable meaning are supplied explicitly by the host.',
        code: `import { MetricCard } from '../src/react/cards';
export default function QueueMetric() {
  return <MetricCard model={{ id: 'queue', kind: 'metric', title: 'Open work', metric: { value: 24, label: 'Open tasks', period: 'This week', delta: -20, comparison: 'Compared with last week', meaning: 'positive' } }} />;
}`,
      },
      {
        id: 'selection',
        title: 'Controlled selection',
        description:
          'Selection is host state. A selected card never selects another record or changes the collection query implicitly.',
        code: `import { useState } from 'react';
import { PurposeCard } from '../src/react/cards';
export default function SelectionCard() {
  const [selected, setSelected] = useState(false);
  return <PurposeCard model={{ id: 'review', kind: 'selection', title: 'Design review', selection: { mode: 'multiple', selected, group: 'reviews' } }} onSelectionChange={setSelected} />;
}`,
      },
      {
        id: 'task',
        title: 'A task with an explicit move callback',
        description:
          'Named move buttons provide the non-drag path. The host owns the task lane and decides whether a move can be applied.',
        code: `import { useState } from 'react';
import { PurposeCard } from '../src/react/cards';
import type { GenUXCardModel } from '../src/data/card-model';
export default function TaskCard() {
  const [lane, setLane] = useState<NonNullable<GenUXCardModel['task']>['lane']>('planned');
  return <PurposeCard model={{ id: 'task-1', kind: 'task', title: 'Prepare review', task: { lane, priority: 'normal', completed: 1, total: 3 } }} onMove={setLane} />;
}`,
      },
      {
        id: 'recipe',
        title: 'A domain recipe',
        description:
          'The catalog offers domain fixtures as data. Render one selected recipe and connect its primary action to a real local detail view.',
        code: `import { PurposeCard } from '../src/react/cards';
import { CARD_RECIPES } from '../src/data/card-recipes';
import type { GenUXCardModel } from '../src/data/card-model';
export default function RecipeCard({ onInspect }: { onInspect: (model: GenUXCardModel) => void }) {
  const recipe = CARD_RECIPES[0];
  return <PurposeCard model={recipe.model} onAction={(_action, model) => onInspect(model)} />;
}`,
      },
      {
        id: 'fields',
        title: 'From bounded metadata to a record card',
        description:
          'Data-only descriptors compile to trusted field definitions. Protected or unavailable values are never read, and zero remains a value.',
        code: `import { EntityCard } from '../src/react/cards';
import { compileFieldDescriptors, entityCardFromFields } from '../src/data/card-field-adapter';
const fields = compileFieldDescriptors<{ id: string; amount: number }>([{ key: 'amount', label: 'Amount', kind: 'money', currency: 'EUR', precision: 2 }]);
export default function MetadataCard() {
  const model = entityCardFromFields({ id: 'ORDER-0', amount: 0 }, fields);
  return <EntityCard model={model} />;
}`,
      },
      {
        id: 'peers',
        title: 'Peer cards in a grid',
        description:
          'A collection layout owns its spacing. Each card is a sibling; cards cannot contain other cards.',
        code: `import { EntityCard } from '../src/react/cards';
export default function PeerCards() {
  return <div className="pattern-grid">{['Design', 'Engineering', 'Operations'].map(title => <EntityCard key={title} model={{ id: title.toLowerCase(), kind: 'entity', title }} />)}</div>;
}`,
      },
    ],
    apiDescription:
      'GenUXCard owns trusted presentation slots. EntityCard, MetricCard and PurposeCard consume a serializable GenUXCardModel; callbacks, queries and authorization stay with the host. The optional lab loads X Cards and X SDK only after explicit intent.',
    api: [
      {
        property: 'model',
        type: 'GenUXCardModel',
        defaultValue: 'required',
        description:
          'Serializable purpose, identity, content, state, facts and optional action. It contains no JSX, callbacks, HTML or CSS.',
      },
      {
        property: 'onAction',
        type: '(action: CardAction, model: GenUXCardModel) => void',
        defaultValue: 'undefined',
        description:
          'An explicit host callback. Without a handler, a supplied primary action is disabled with an explanation.',
      },
      {
        property: 'onSelectionChange / onMove / onFieldChange',
        type: 'GenUXCardCallbacks',
        defaultValue: 'undefined',
        description:
          'Controlled selection, task lane and field editing. Callbacks do not persist or authorize changes.',
      },
      {
        property: 'radius / outlined',
        type: "'0' | '3' | '5' / boolean",
        defaultValue: 'shared radius / false',
        description:
          'Trusted presentation props. Small shared corners and an optional functional boundary; a full-round card is unsupported.',
      },
      {
        property: 'headingLevel',
        type: '3 | 4 | 5',
        defaultValue: '4',
        description: 'Real headings maintain a useful reading order inside a page or collection.',
      },
      {
        property: 'model.state',
        type: "'ready' | 'loading' | 'empty' | 'partial' | 'error' | 'disabled'",
        defaultValue: "'ready'",
        description:
          'Explicit data state with an announced message and controlled recovery. Loading does not imply a network request.',
      },
      {
        property: 'model.layout / model.density',
        type: "'vertical' | 'horizontal' | 'auto' / 'compact' | 'comfortable'",
        defaultValue: "'vertical' / 'comfortable'",
        description:
          'Semantic presentation hints adapt within the available card space, without changing data or actions.',
      },
      {
        property: 'compileFieldDescriptors',
        type: 'unknown → readonly FieldDefinition<R>[]',
        defaultValue: 'explicit call',
        description:
          'A bounded data-only metadata compiler. Direct own scalar values are read after availability checks; executable descriptors are unsupported.',
      },
      {
        property: 'adaptFrappeDocType',
        type: 'unknown → FrappeCardAdaptation',
        defaultValue: 'explicit call',
        description:
          'A local scalar metadata bridge reporting unsupported types and dynamic currency references. It does not connect to Frappe or resolve permissions.',
      },
      {
        property: 'GalleryView / DashboardView',
        type: 'ViewAdapterProps<R> / supplied metric models',
        defaultValue: 'explicit host composition',
        description:
          'Reusable workspace adapters. Gallery preserves host query, active and checked IDs; Dashboard renders host-supplied metrics without inventing aggregation.',
      },
    ],
    nativeApi: [
      {
        property: 'Card',
        type: 'native Ant Design 6.6.6',
        defaultValue: 'trusted GenUX adapter',
        description:
          'GenUXCard uses native Card for its surface, with shared sm/md/lg spacing and supported small/medium native sizes.',
      },
      {
        property: 'X Cards / X SDK',
        type: 'optional lab packages',
        defaultValue: 'not loaded by the basic catalog',
        description:
          'Advanced rendering and local stream examples belong to the optional GenUX lab, separate from the baseline renderer.',
      },
    ],
    accessibility: [
      'Keep one subject and a real heading per card. Peer cards are siblings, never nested visual cards.',
      'Use named primary actions, native selection controls and a non-drag alternative for moving tasks.',
      'At 320 CSS px, preserve readable content, source context and shared button targets; scroll only bounded collection surfaces.',
      'Preserve controlled values, selection and open local details through size, theme and locale changes.',
    ],
    notes: [
      'The purpose catalog covers 23 card purposes and at least 31 domain recipes, one selected preview at a time.',
      'Entity and Metric are the foundation. The page then groups domain recipes, interactions, states and the optional GenUX lab.',
      'No initial Card page import requires X Cards or X SDK. Open the lab explicitly to request its additional resources.',
      'Every example action changes local host state only. Metadata and supplied capability reasons do not prove server authorization.',
      'Card is a web experiment; this delivery does not promote approved decisions or Storybook stories.',
    ],
  },
  {
    slug: 'data-table',
    title: 'Data table',
    summary:
      'Explore readable tables, grouping, hierarchy and local row editing with stable records, explicit selection and shared GenUX controls.',
    antdComponent: 'Table · Input · Checkbox',
    category: 'Data workspace',
    sourceUrl: 'https://ant.design/components/table/',
    whenToUse: [
      'For structured records whose fields need aligned headers, sorting and filtering.',
      'For grouped or hierarchical records and explicitly saved local row drafts.',
    ],
    examples: [
      {
        id: 'composition',
        title: 'Data table composition',
        description:
          'The table example composes actual Ant Design Table with the shared fixture, selection and local draft model.',
        code: "import { DataTableDemo } from '../src/react/workspace/CollectionDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-collections.css';\n\nexport default function Example() {\n  return <DataTableDemo />;\n}",
      },
      {
        id: 'composition-detail',
        title: 'Mobile table alternative',
        description:
          'Choose the mobile record layout without duplicating the table data or selection model.',
        code: "import CollectionDemo from '../src/react/workspace/CollectionDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-collections.css';\n\nexport default function Example() {\n  return <CollectionDemo tableOnly initialProfile=\"mobile\" />;\n}",
      },
    ],
    apiDescription:
      'This page renders the CollectionDemo gallery. The RecordCollection API rows refer to the separate controlled kit on Record workspace; native Ant Design settings are listed separately.',
    api: [
      {
        property: 'CollectionDemo',
        type: '{ tableOnly?: boolean; initialProfile?: mobile | desktop }',
        defaultValue: 'Local gallery',
        description:
          'The existing gallery owns its fictional fixture. Use RecordCollection for caller-owned records and state.',
      },
      {
        property: 'RecordCollection<R>.records',
        type: 'readonly R[]',
        defaultValue: 'Required',
        description: 'Records and field definitions are supplied by the caller.',
      },
      {
        property: 'fields',
        type: 'readonly FieldDefinition<R>[]',
        defaultValue: 'Required',
        description: 'The same field definitions supply read, edit, validation and filter meaning.',
      },
      {
        property: 'state / capabilities',
        type: 'SurfaceState / RecordCapabilities',
        defaultValue: 'Caller supplied',
        description:
          'Loading, unavailable values and action reasons are supplied explicitly; these components do not authorize server operations.',
      },
      {
        property: 'query / onQueryChange',
        type: 'QueryState / callback',
        defaultValue: 'Required',
        description:
          'Search, typed filters and independent sort directions are controlled by the caller.',
      },
      {
        property: 'activeId / checkedIds',
        type: 'string | null / readonly string[]',
        defaultValue: 'Required',
        description: 'Inspection and checked action targets remain independent.',
      },
      {
        property: 'projection / onProjectionChange',
        type: 'readonly string[] / callback',
        defaultValue: 'Required',
        description: 'Visible fields change presentation without changing the record set.',
      },
    ],
    nativeApi: [
      {
        property: 'rowKey',
        type: 'string | function',
        defaultValue: "'id'",
        description: 'Stable record IDs keep selection independent of row position.',
      },
      {
        property: 'rowSelection',
        type: 'Table row selection configuration',
        defaultValue: 'Controlled by the example',
        description: 'Checked target IDs are separate from the record opened for inspection.',
      },
      {
        property: 'scroll',
        type: 'Table scroll configuration',
        defaultValue: 'The outer region scrolls',
        description:
          'The demo uses a focusable outer scroll region; readable column minima are preserved instead of compressing text.',
      },
    ],
    accessibility: [
      'Mobile and desktop examples share record identity and preserve authored drafts.',
      'Table columns retain readable minimum widths and scroll inside their own container.',
      'Controls support keyboard access with one visible non-surrounding focus indicator.',
    ],
    notes: [
      'Controlled collection, form and display components are demonstrated together on the Record workspace page.',
      'Experimental web examples awaiting user approval. They are not added to Storybook or the approved decision model.',
      'The examples use twelve fictional records and local state. They do not implement a server, permissions, live AI, an ERP engine or persistence.',
      'The reference material supplies data arrangements and view types. The visual identity comes from existing GenUX components and semantic tokens.',
    ],
  },
  {
    slug: 'collection-views',
    title: 'Collection views',
    summary:
      'Compare collection representations and task arrangements: tables, lists, Kanban, calendar, Gantt, row editing, comparison, review and bulk change. The reusable kit adds a separate cell-edit grid.',
    antdComponent: 'Table · Select · Checkbox · Drawer',
    category: 'Data workspace',
    sourceUrl: 'https://ant.design/components/table/',
    whenToUse: [
      'For choosing a representation that matches the task while retaining filters and record identity.',
      'For comparing selected records, inspecting groups or previewing a local bulk change.',
    ],
    examples: [
      {
        id: 'composition',
        title: 'Collection workbench',
        description:
          'View changes share the same fixture, query, filters, sorting, checked targets and active record.',
        code: "import CollectionDemo from '../src/react/workspace/CollectionDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-collections.css';\n\nexport default function Example() {\n  return <CollectionDemo />;\n}",
      },
      {
        id: 'composition-detail',
        title: 'Desktop collection layout',
        description:
          'Start with the desktop layout; the same toolbar, records and local state support every available presentation.',
        code: "import CollectionDemo from '../src/react/workspace/CollectionDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-collections.css';\n\nexport default function Example() {\n  return <CollectionDemo initialProfile=\"desktop\" />;\n}",
      },
    ],
    apiDescription:
      'This page renders the CollectionDemo gallery. The RecordCollection API rows refer to the separate controlled kit on Record workspace; native Ant Design settings are listed separately.',
    api: [
      {
        property: 'CollectionDemo',
        type: '{ tableOnly?: boolean; initialProfile?: mobile | desktop }',
        defaultValue: 'Local gallery',
        description:
          'The existing gallery owns its fictional fixture. Use RecordCollection for caller-owned records and state.',
      },
      {
        property: 'RecordCollection<R>.records',
        type: 'readonly R[]',
        defaultValue: 'Required',
        description: 'Records and field definitions are supplied by the caller.',
      },
      {
        property: 'fields',
        type: 'readonly FieldDefinition<R>[]',
        defaultValue: 'Required',
        description: 'The same field definitions supply read, edit, validation and filter meaning.',
      },
      {
        property: 'state / capabilities',
        type: 'SurfaceState / RecordCapabilities',
        defaultValue: 'Caller supplied',
        description:
          'Loading, unavailable values and action reasons are supplied explicitly; these components do not authorize server operations.',
      },
      {
        property: 'query / onQueryChange',
        type: 'QueryState / callback',
        defaultValue: 'Required',
        description:
          'Search, typed filters and independent sort directions are controlled by the caller.',
      },
      {
        property: 'activeId / checkedIds',
        type: 'string | null / readonly string[]',
        defaultValue: 'Required',
        description: 'Inspection and checked action targets remain independent.',
      },
      {
        property: 'projection / onProjectionChange',
        type: 'readonly string[] / callback',
        defaultValue: 'Required',
        description: 'Visible fields change presentation without changing the record set.',
      },
    ],
    nativeApi: [
      {
        property: 'Select.value / onChange',
        type: 'Controlled value / callback',
        defaultValue: 'Stable machine identifiers',
        description: 'Presentation labels translate while selected values remain stable.',
      },
      {
        property: 'Checkbox.checked',
        type: 'boolean',
        defaultValue: 'Controlled by record ID',
        description: 'Opening a record does not select it for a bulk operation.',
      },
      {
        property: 'Drawer.open',
        type: 'boolean',
        defaultValue: 'false',
        description:
          'Filter and field customization surfaces keep collection state outside the panel.',
      },
    ],
    accessibility: [
      'Mobile and desktop examples share record identity and preserve authored drafts.',
      'Table columns retain readable minimum widths and scroll inside their own container.',
      'Controls support keyboard access with one visible non-surrounding focus indicator.',
    ],
    notes: [
      'Controlled collection, form and display components are demonstrated together on the Record workspace page.',
      'Experimental web examples awaiting user approval. They are not added to Storybook or the approved decision model.',
      'The examples use twelve fictional records and local state. They do not implement a server, permissions, live AI, an ERP engine or persistence.',
      'The reference material supplies data arrangements and view types. The visual identity comes from existing GenUX components and semantic tokens.',
    ],
  },
  {
    slug: 'record-details',
    title: 'Record details',
    summary:
      'Inspect the same record through full-page, modal, drawer, sheet, inline and split presentations while retaining keyed local drafts.',
    antdComponent: 'Drawer · Modal · Input',
    category: 'Data workspace',
    sourceUrl: 'https://ant.design/components/drawer/',
    whenToUse: [
      'For reading or editing one record without conflating its content with the presentation container.',
      'For comparing mobile and desktop detail access, related data and local record drafts.',
    ],
    examples: [
      {
        id: 'composition',
        title: 'Details composition',
        description:
          'One record model and keyed draft store support the experimental presentation containers.',
        code: "import RecordDetailsDemo from '../src/react/workspace/RecordDetailsDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-details.css';\n\nexport default function Example() {\n  return <RecordDetailsDemo />;\n}",
      },
      {
        id: 'composition-detail',
        title: 'Shared record summary',
        description:
          'Use the same semantic record summary in a collection pane or a detail surface.',
        code: "import GenUXProvider from '../src/react/GenUXProvider';\nimport RecordSummary from '../src/react/workspace/RecordSummary';\nimport { initialRecords } from '../src/data/workspace';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-kit.css';\n\nexport default function Example() {\n  const record = initialRecords()[0];\n  return record ? <GenUXProvider><div className=\"workspace-lab\"><RecordSummary record={record} /></div></GenUXProvider> : null;\n}",
      },
    ],
    apiDescription:
      'This page renders the RecordDetailsDemo gallery. The RecordDisplay and RecordPanel API rows refer to the separate controlled kit on Record workspace; native Ant Design settings are listed separately.',
    api: [
      {
        property: 'RecordDetailsDemo',
        type: '() => ReactElement',
        defaultValue: 'Local gallery',
        description:
          'The existing gallery owns its record and overlay choices. Use RecordDisplay for caller-owned data and presentation.',
      },
      {
        property: 'RecordDisplay<R>.record / recordId',
        type: 'R | null / string | null',
        defaultValue: 'Caller supplied',
        description:
          'Record identity remains explicit during loading, errors and not-found states.',
      },
      {
        property: 'fields',
        type: 'readonly FieldDefinition<R>[]',
        defaultValue: 'Required',
        description: 'The same field definitions supply read, edit, validation and filter meaning.',
      },
      {
        property: 'state / capability',
        type: 'SurfaceState / Capability',
        defaultValue: 'Caller supplied',
        description:
          'Loading, unavailable values and action reasons are supplied explicitly; these components do not authorize server operations.',
      },
      {
        property: 'presentation',
        type: 'page | sections | tabs | accordion',
        defaultValue: 'page',
        description:
          'Content organization is controlled separately from an outer modal, drawer or page container.',
      },
      {
        property: 'onEdit / onClose',
        type: 'callbacks',
        defaultValue: 'Optional',
        description:
          'The caller decides edit and return behavior; displaying a record never commits a draft.',
      },
    ],
    nativeApi: [
      {
        property: 'open / onClose',
        type: 'boolean / callback',
        defaultValue: 'Controlled by the example',
        description:
          'Native overlays manage their closing lifecycle and return focus to a connected trigger.',
      },
      {
        property: 'focusable',
        type: 'Native overlay focus configuration',
        defaultValue: 'Modal trap and trigger restoration',
        description:
          'Modal focus rules are separate from non-modal inline and split presentations.',
      },
      {
        property: 'destroyOnHidden',
        type: 'boolean',
        defaultValue: 'false (AntD); true (example)',
        description:
          'Both demo overlays remove hidden bodies. Drafts survive because their keyed state is owned outside the overlay.',
      },
    ],
    accessibility: [
      'Mobile and desktop examples share record identity and preserve authored drafts.',
      'Keep section navigation, related-record return context and long-content actions reachable in modal and non-modal containers.',
      'Controls support keyboard access with one visible non-surrounding focus indicator.',
    ],
    notes: [
      'Controlled collection, form and display components are demonstrated together on the Record workspace page.',
      'Experimental web examples awaiting user approval. They are not added to Storybook or the approved decision model.',
      'The examples use twelve fictional records and local state. They do not implement a server, permissions, live AI, an ERP engine or persistence.',
      'The reference material supplies data arrangements and view types. The visual identity comes from existing GenUX components and semantic tokens.',
    ],
  },
  {
    slug: 'record-forms',
    title: 'Record forms',
    summary:
      'Explore single-page, multistep, section, tab, accordion and header-line forms with one persistent draft and validation across hidden groups.',
    antdComponent: 'Form · Input · Select · InputNumber',
    category: 'Data workspace',
    sourceUrl: 'https://ant.design/components/form/',
    whenToUse: [
      'For exploring form flow and field organization as independent choices.',
      'For validating repeated line items and revealing an invalid field in another step or closed group.',
    ],
    examples: [
      {
        id: 'composition',
        title: 'Form composition',
        description:
          'The form gallery preserves the same fields and local draft across organization and language changes.',
        code: "import RecordFormsDemo from '../src/react/workspace/RecordFormsDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-forms.css';\n\nexport default function Example() {\n  return <RecordFormsDemo />;\n}",
      },
      {
        id: 'composition-detail',
        title: 'Compose the form under one provider',
        description:
          'The named form example can share an existing GenUXProvider without nesting a second theme provider.',
        code: "import GenUXProvider from '../src/react/GenUXProvider';\nimport { RecordFormsExamples } from '../src/react/workspace/RecordFormsDemo';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-forms.css';\n\nexport default function Example() {\n  return <GenUXProvider><RecordFormsExamples /></GenUXProvider>;\n}",
      },
    ],
    apiDescription:
      'This page renders the RecordFormsDemo gallery. The RecordForm API rows refer to the separate controlled kit on Record workspace; native Ant Design settings are listed separately.',
    api: [
      {
        property: 'RecordFormsDemo / RecordFormsExamples',
        type: '() => ReactElement',
        defaultValue: 'Local gallery',
        description:
          'The existing gallery accepts no form-data props. Use RecordForm for a controlled reusable form.',
      },
      {
        property: 'RecordForm<R>.record / draft',
        type: 'R / R',
        defaultValue: 'Required',
        description:
          'Committed data and draft data remain separate until the caller explicitly commits.',
      },
      {
        property: 'fields',
        type: 'readonly FieldDefinition<R>[]',
        defaultValue: 'Required',
        description: 'The same field definitions supply read, edit, validation and filter meaning.',
      },
      {
        property: 'operation / capability',
        type: 'OperationState / Capability',
        defaultValue: 'Caller supplied',
        description:
          'Loading, unavailable values and action reasons are supplied explicitly; these components do not authorize server operations.',
      },
      {
        property: 'errors / onDraftChange',
        type: 'FieldErrors / callback',
        defaultValue: 'Required',
        description: 'The caller supplies field errors and receives immutable draft changes.',
      },
      {
        property: 'onCommit / onCancel',
        type: 'callbacks',
        defaultValue: 'Required',
        description:
          'Submission validates all relevant fields; cancel requests discard without changing the committed record.',
      },
      {
        property: 'organization',
        type: 'page | sections | steps | tabs | accordion',
        defaultValue: 'page',
        description:
          'Organization changes preserve one mounted field tree. Progression does not imply a business command.',
      },
    ],
    nativeApi: [
      {
        property: 'Form.form',
        type: 'FormInstance',
        defaultValue: 'Form.useForm()',
        description:
          'One persistent form instance owns all organizations and presentation profiles.',
      },
      {
        property: 'preserve',
        type: 'boolean',
        defaultValue: 'true',
        description: 'Hidden groups retain entered values and validation state.',
      },
      {
        property: 'Form.List',
        type: 'Stable keyed repeated fields',
        defaultValue: 'Local example lines',
        description: 'Line identity is retained when another line is added or removed.',
      },
    ],
    accessibility: [
      'Mobile and desktop examples share record identity and preserve authored drafts.',
      'The controlled RecordForm on Record workspace provides the navigable error summary. This gallery reveals invalid hidden groups and focuses their fields.',
      'Controls support keyboard access with one visible non-surrounding focus indicator.',
    ],
    notes: [
      'Controlled collection, form and display components are demonstrated together on the Record workspace page.',
      'Experimental web examples awaiting user approval. They are not added to Storybook or the approved decision model.',
      'The examples use twelve fictional records and local state. They do not implement a server, permissions, live AI, an ERP engine or persistence.',
      'The reference material supplies data arrangements and view types. The visual identity comes from existing GenUX components and semantic tokens.',
    ],
  },
  {
    slug: 'record-workspace',
    title: 'Record workspace',
    summary:
      'Create, list and inspect local records with controlled components, shared fields and explicit drafts across order and equipment schemas.',
    antdComponent: 'Input · Select · Checkbox · Form',
    category: 'Data workspace',
    sourceUrl: 'https://ant.design/components/form/',
    whenToUse: [
      'For composing a reusable listing, entry and single-record display with caller-owned data.',
      'For reviewing field semantics, validation, action scope and state recovery across two distinct schemas.',
    ],
    examples: [
      {
        id: 'connected',
        title: 'Connected local journey',
        description:
          'The same record ID moves from a draft through explicit local commit to the collection and read display.',
        code: "import ConnectedWorkspace from '../src/react/workspace/kit/ConnectedWorkspace';\nimport '../src/styles/workspace.css';\nimport '../src/styles/workspace-kit.css';\nimport '../src/styles/workspace-connected.css';\nimport '../src/styles/kit-collections.css';\nimport '../src/styles/kit-records.css';\n\nexport default function Example() {\n  return <ConnectedWorkspace />;\n}",
      },
      {
        id: 'controlled-collection',
        title: 'Controlled collection',
        description:
          'The consumer owns query, selection, active record and field projection independently.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport RecordCollection from '../src/react/workspace/kit/RecordCollection';\nimport type { FieldDefinition, QueryState } from '../src/react/workspace/kit/contracts';\nimport '../src/styles/workspace-kit.css';\nimport '../src/styles/kit-collections.css';\nimport '../src/styles/genux-pagination.css';\n\ntype Row = { id: string; name: string };\nconst fields: FieldDefinition<Row>[] = [{ key: 'name', label: 'Name', kind: 'text',\n  getValue: row => row.name, setValue: (row, value) => ({ ...row, name: String(value ?? '') }) }];\nexport default function ControlledListing() {\n  const [query, setQuery] = useState<QueryState>({ search: '', filters: [], sort: [] });\n  const [activeId, setActiveId] = useState<string | null>(null);\n  const [checkedIds, setCheckedIds] = useState<readonly string[]>([]);\n  const [projection, setProjection] = useState<readonly string[]>(['name']);\n  return <GenUXProvider><RecordCollection records={[{ id: 'r1', name: 'Example' }]}\n    fields={fields} query={query} onQueryChange={setQuery}\n    activeId={activeId} onActiveIdChange={setActiveId}\n    checkedIds={checkedIds} onCheckedIdsChange={setCheckedIds}\n    projection={projection} onProjectionChange={setProjection} /></GenUXProvider>;\n}",
      },
      {
        id: 'controlled-record',
        title: 'Controlled form and display',
        description: 'Only an explicit commit changes the read display; typing changes the draft.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport RecordForm from '../src/react/workspace/kit/RecordForm';\nimport RecordDisplay from '../src/react/workspace/kit/RecordDisplay';\nimport type { FieldDefinition } from '../src/react/workspace/kit/contracts';\nimport '../src/styles/workspace-kit.css';\nimport '../src/styles/kit-records.css';\n\ntype Row = { id: string; name: string };\nconst fields: FieldDefinition<Row>[] = [{ key: 'name', label: 'Name', kind: 'text', required: true,\n  getValue: row => row.name, setValue: (row, value) => ({ ...row, name: String(value ?? '') }) }];\nexport default function ControlledRecord() {\n  const [record, setRecord] = useState<Row>({ id: 'r1', name: 'Example' });\n  const [draft, setDraft] = useState(record);\n  return <GenUXProvider><RecordForm record={record} draft={draft} fields={fields} errors={{}}\n    onDraftChange={setDraft} onCommit={next => { setRecord(next); setDraft(next); }}\n    onCancel={() => setDraft(record)} />\n    <RecordDisplay record={record} fields={fields} /></GenUXProvider>;\n}",
      },
      {
        id: 'controlled-panel',
        title: 'Controlled record container',
        description:
          'Container and relation return actions remain caller-owned while the same record is displayed.',
        code: "import { useState } from 'react';\nimport GenUXProvider from '../src/react/GenUXProvider';\nimport GenUXButton from '../src/react/GenUXButton';\nimport RecordPanel from '../src/react/workspace/kit/RecordPanel';\nimport type { FieldDefinition } from '../src/react/workspace/kit/contracts';\nimport '../src/styles/workspace-kit.css';\nimport '../src/styles/kit-records.css';\n\ntype Row = { id: string; name: string };\nconst record: Row = { id: 'r1', name: 'Example' };\nconst fields: FieldDefinition<Row>[] = [{ key: 'name', label: 'Name', kind: 'text', getValue: row => row.name }];\nexport default function ControlledPanel() {\n  const [open, setOpen] = useState(false);\n  return <GenUXProvider><GenUXButton text=\"Open record\" onClick={() => setOpen(true)} />\n    <RecordPanel open={open} onClose={() => setOpen(false)} container=\"drawer\"\n      record={record} fields={fields} presentation=\"sections\"\n      returnTrail={[{ id: 'list', label: 'All records', onReturn: () => setOpen(false) }]} />\n    </GenUXProvider>;\n}",
      },
    ],
    apiDescription:
      'These are reusable GenUX contracts. The connected gallery is one local consumer of the same components.',
    api: [
      {
        property: 'RecordCollection.boardFieldKey / supportedViews',
        type: 'string / readonly CollectionView[]',
        defaultValue: 'Relevant supplied fields',
        description:
          'Board lanes are independent of smart groups; calendar, date spans and hierarchy use actual supplied prerequisites.',
      },
      {
        property: 'RecordCollection.pageSize / page / onPageChange',
        type: 'number / number / callback',
        defaultValue: '25 rows; maximum 100 per page',
        description:
          'Client-side pagination bounds rendered records. It does not provide server paging or virtualization.',
      },
      {
        property: 'EditableGrid.operation / baselines',
        type: 'OperationState / GridDrafts<R>',
        defaultValue: 'Caller supplied or captured',
        description:
          'Pending and unknown outcomes block repeat commits; stale baselines and non-projected errors remain explicit.',
      },
      {
        property: 'RecordForm.dirty / stale / nonFieldErrors',
        type: 'boolean / boolean / readonly string[]',
        defaultValue: 'Derived dirty state',
        description:
          'Dirty cancellation requires an explicit discard decision; commit includes the base record and stale edits are blocked.',
      },
      {
        property: 'RecordPanel.closeGuard / render / fallbackFocusRef',
        type: 'callback / render callback / ref',
        defaultValue: 'Caller policy',
        description:
          'Form containers can block or review closing, retain sections across reopen and return focus to a connected fallback.',
      },
      {
        property: 'RecordTabs / RecordInspector',
        type: 'Controlled tab and inspector components',
        defaultValue: 'Six tabs; bounded width',
        description:
          'Record identity, pin state, inspector width and close actions remain caller-owned; narrow layouts retain the same records.',
      },
      {
        property: 'ImportCorrectionQueue',
        type: 'Supplied source/current/proposed correction queue',
        defaultValue: 'Caller supplied',
        description:
          'Corrections and reviewed IDs are explicit. No file parsing, extraction, AI or backend operation is implied.',
      },
      {
        property: 'FieldDefinition<R>',
        type: 'key / label / kind / getValue / setValue',
        defaultValue: 'Caller supplied',
        description:
          'Shared field meaning includes null, zero, precision, currency, units, availability and editability.',
      },
      {
        property: 'RecordCollection<R>',
        type: 'RecordCollectionProps<R>',
        defaultValue: 'Controlled',
        description:
          'Records, query, active ID, checked IDs and projection have separate callback ownership.',
      },
      {
        property: 'columns',
        type: 'readonly CollectionColumn[]',
        defaultValue: 'Individual projected fields',
        description:
          'Composite columns group visible leaf fields. Each subfield keeps its own filter, sort and value semantics.',
      },
      {
        property: 'RecordForm<R>',
        type: 'RecordFormProps<R>',
        defaultValue: 'Controlled',
        description:
          'The draft, errors and commit/cancel requests are explicit inputs and callbacks.',
      },
      {
        property: 'RecordDisplay<R>',
        type: 'RecordDisplayProps<R>',
        defaultValue: 'Controlled',
        description: 'The caller supplies identity, data, state, field sets and presentation.',
      },
      {
        property: 'RecordPanel<R>',
        type: 'RecordPanelProps<R>',
        defaultValue: 'Controlled',
        description:
          'The caller owns open state, container, record identity and relation return trail. Modal and drawer consumers use native focus lifecycles.',
      },
      {
        property: 'StateSurface',
        type: 'SurfaceState',
        defaultValue: 'Required',
        description:
          'Supplied loading, empty, no-match, error, denied, not-found, partial, stale and unknown states offer relevant recovery.',
      },
      {
        property: 'EntityPicker / RepeatingRecordEditor',
        type: 'ID-based related options / stable child rows',
        defaultValue: 'Controlled',
        description:
          'Related labels do not replace stored IDs; reordered child rows retain their own errors.',
      },
      {
        property: 'ChangeReview / ReviewQueue',
        type: 'Prepared targets / supplied result and queue state',
        defaultValue: 'Controlled',
        description: 'Inspection, checking, preparation and business decisions remain separate.',
      },
      {
        property: 'AttachmentList / EventList / RecordDiff',
        type: 'Supplied typed metadata and content',
        defaultValue: 'Optional',
        description:
          'Unsupported, empty and error states are explicit; these surfaces do not fetch files or invent audit history.',
      },
    ],
    accessibility: [
      'Use the mobile example at 320 CSS px; tables scroll within their own named keyboard region without shrinking text.',
      'Reveal and focus invalid fields through the error summary while preserving the single mounted field tree.',
      'Entity IDs, checked targets and return context stay stable when labels, layout or content organization change.',
      'Use one visible non-surrounding focus marker and preserve reduced-motion preferences.',
    ],
    notes: [
      'Experimental reusable web components; Storybook and approved component decisions are unchanged.',
      'The connected fixture performs local commits only. Refreshing the page resets its record data; exported color settings have their own separate storage contract.',
      'Date-only fields, explicit UTC instants and paired date ranges preserve their meaning across edit, listing and display.',
      'Column pinning, resizing, range selection and clipboard grids are not part of this implementation. Specialized engines and external publishing require their own product scope.',
      'Browser, device, rendered accessibility and visual acceptance remain separate from source and DOM checks.',
    ],
  },
  ...extensionComponents,
  ...contentComponents,
  ...uxPatternComponents,
  ...listyComponents,
  ...badgeComponents,
  ...fabComponents,
];
