import type { ComponentDoc } from './catalog';

/** Catalog entries kept in their own module so each source file stays within the root size guard. */
export const extensionComponents: ComponentDoc[] = [
  {
    slug: 'toast',
    title: 'Toast',
    summary:
      'Brief, non-blocking confirmation of a completed local action. Toast is the GenUX name for the native Ant Design message.',
    antdComponent: 'message',
    category: 'Feedback',
    sourceUrl: 'https://ant.design/components/message/',
    whenToUse: [
      'For a short result that needs no decision, such as a saved local preference.',
      'Use Alert for persistent context, Notification for richer content and Modal when work must stop for a decision.',
    ],
    examples: [
      {
        id: 'profiles',
        title: 'Entry profiles',
        description:
          'Compare the three GenUX entry profiles: top center from the top, top right from the top and top right from the right. Each preview reports a local result only.',
        code: `import { ToastDemo } from '../src/react/FeedbackDemo';

export default function ToastExample() {
  return <ToastDemo documentation />;
}`,
      },
    ],
    apiDescription:
      'The demo island and its GenUX adapter are listed first. Native Ant Design settings follow separately; adapter props are defined in GenUXFeedback.tsx.',
    api: [
      {
        property: 'documentation',
        type: 'boolean',
        defaultValue: 'undefined',
        description:
          'Documentation mode for this local demonstration island. The demo owns its sample state.',
      },
      {
        property: 'useGenUXToast',
        type: 'GenUX adapter hook · GenUXFeedback.tsx',
        defaultValue: '—',
        description:
          'GenUX adapter export over the native API listed below. Its props follow the adapter source; this page does not restate an unpublished signature.',
      },
    ],
    nativeApi: [
      {
        property: 'message.useMessage',
        type: '() => [MessageInstance, ReactElement]',
        defaultValue: '—',
        description:
          'Returns the API and a context holder that inherits the theme. Render the holder inside the provider.',
      },
      {
        property: 'open / type',
        type: 'ArgsProps / success | info | warning | error | loading',
        defaultValue: '—',
        description: 'Shows one entry. Type selects the status icon and meaning.',
      },
      {
        property: 'content / duration',
        type: 'ReactNode / number',
        defaultValue: '— / 3',
        description:
          'Message text and seconds before closing; 0 keeps the entry until it is closed.',
      },
      {
        property: 'key / onClose',
        type: 'string | number / () => void',
        defaultValue: '—',
        description: 'A stable key updates an entry in place instead of stacking duplicates.',
      },
    ],
    accessibility: [
      'Never make a toast the only place an important result appears.',
      'Do not place required actions in a toast; it closes automatically.',
      'Reduced motion removes decorative movement; content and status update immediately.',
    ],
    notes: [
      'Native message places entries at top center. The right-aligned profiles are GenUX presentation on the same native API.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Readable text stays at least 14 CSS px. Radii, colors and motion come from shared GenUX tokens.',
      'Browser contracts for these feedback examples live in docs/browser/drawer-feedback.spec.ts.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'alert',
    title: 'Alert',
    summary:
      'Persistent inline status beside the content it describes. Alert stays in the page flow until the condition changes or someone dismisses it.',
    antdComponent: 'Alert',
    category: 'Feedback',
    sourceUrl: 'https://ant.design/components/alert/',
    whenToUse: [
      'For a condition that applies to a section or form and should remain readable while people work.',
      'Use Toast for a brief result and Modal only when the task cannot continue without a decision.',
    ],
    examples: [
      {
        id: 'statuses',
        title: 'Status and actions',
        description:
          'Success, info, warning and error alerts use text and icons, not color alone. Closing and actions change local state only.',
        code: `import { AlertDemo } from '../src/react/FeedbackDemo';

export default function AlertExample() {
  return <AlertDemo documentation />;
}`,
      },
    ],
    apiDescription:
      'The demo island and its GenUX adapter are listed first. Native Ant Design settings follow separately; adapter props are defined in GenUXFeedback.tsx.',
    api: [
      {
        property: 'documentation',
        type: 'boolean',
        defaultValue: 'undefined',
        description:
          'Documentation mode for this local demonstration island. The demo owns its sample state.',
      },
      {
        property: 'GenUXAlert',
        type: 'GenUX adapter component · GenUXFeedback.tsx',
        defaultValue: '—',
        description:
          'GenUX adapter export over the native API listed below. Its props follow the adapter source; this page does not restate an unpublished signature.',
      },
    ],
    nativeApi: [
      {
        property: 'type',
        type: 'success | info | warning | error',
        defaultValue: 'info',
        description: 'Status meaning and default icon.',
      },
      {
        property: 'title / description',
        type: 'ReactNode / ReactNode',
        defaultValue: '—',
        description:
          'Main message and supporting detail. Check the installed reference for deprecated aliases.',
      },
      {
        property: 'showIcon / banner',
        type: 'boolean / boolean',
        defaultValue: 'false / false',
        description: 'Status icon and full-width banner presentation.',
      },
      {
        property: 'closable / onClose',
        type: 'boolean | ClosableType / function',
        defaultValue: 'false / —',
        description:
          'Optional dismissal. Dismissing hides the message; it does not resolve the condition.',
      },
      {
        property: 'action',
        type: 'ReactNode',
        defaultValue: '—',
        description: 'A related action rendered beside the message.',
      },
    ],
    accessibility: [
      'Native Alert uses role=alert; insert it when the condition appears so it is announced once.',
      'Status is conveyed by text and icon as well as color.',
      'Keyboard focus uses one visible non-surrounding marker; surrounding focus rings are not used.',
    ],
    notes: [
      'Alert is persistent and inline; it is not a floating message.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Readable text stays at least 14 CSS px. Radii, colors and motion come from shared GenUX tokens.',
      'Browser contracts for these feedback examples live in docs/browser/drawer-feedback.spec.ts.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'notification',
    title: 'Notification',
    summary:
      'Richer, non-blocking feedback with a title, description and optional action, shown at the edge of the page without interrupting work.',
    antdComponent: 'notification',
    category: 'Feedback',
    sourceUrl: 'https://ant.design/components/notification/',
    whenToUse: [
      'For a result that needs a title and explanation, or offers one optional follow-up action.',
      'Keep essential information on the page as well. Notifications close and can be missed.',
    ],
    examples: [
      {
        id: 'placements',
        title: 'Placement and content',
        description:
          'Open notifications in different placements with a description and an optional action. Every action reports a local result.',
        code: `import { NotificationDemo } from '../src/react/FeedbackDemo';

export default function NotificationExample() {
  return <NotificationDemo documentation />;
}`,
      },
    ],
    apiDescription:
      'The demo island and its GenUX adapter are listed first. Native Ant Design settings follow separately; adapter props are defined in GenUXFeedback.tsx.',
    api: [
      {
        property: 'documentation',
        type: 'boolean',
        defaultValue: 'undefined',
        description:
          'Documentation mode for this local demonstration island. The demo owns its sample state.',
      },
      {
        property: 'useGenUXNotification',
        type: 'GenUX adapter hook · GenUXFeedback.tsx',
        defaultValue: '—',
        description:
          'GenUX adapter export over the native API listed below. Its props follow the adapter source; this page does not restate an unpublished signature.',
      },
    ],
    nativeApi: [
      {
        property: 'notification.useNotification',
        type: '() => [NotificationInstance, ReactElement]',
        defaultValue: '—',
        description:
          'Returns the API and a context holder that inherits the theme. Render the holder inside the provider.',
      },
      {
        property: 'open / success / info / warning / error',
        type: 'ArgsProps',
        defaultValue: '—',
        description: 'Shows an entry with a status meaning.',
      },
      {
        property: 'title / description',
        type: 'ReactNode / ReactNode',
        defaultValue: '—',
        description:
          'Main message and supporting detail. Check the installed reference for deprecated aliases.',
      },
      {
        property: 'placement',
        type: 'top | topLeft | topRight | bottom | bottomLeft | bottomRight',
        defaultValue: 'topRight',
        description: 'Corner or edge where entries stack.',
      },
      {
        property: 'duration / key / onClose',
        type: 'number / string | number / () => void',
        defaultValue: '4.5 / — / —',
        description:
          'Seconds before closing; 0 keeps the entry open. A stable key updates an entry in place.',
      },
    ],
    accessibility: [
      'Write a specific title. Actions inside a notification must also be reachable elsewhere because the entry can close.',
      'Close buttons have accessible names and keep shared minimum target sizes.',
      'Keyboard focus uses one visible non-surrounding marker; surrounding focus rings are not used.',
      'Reduced motion removes decorative movement; content and status update immediately.',
    ],
    notes: [
      'Notification is rich and transient; use it for useful context that is not required to continue.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Readable text stays at least 14 CSS px. Radii, colors and motion come from shared GenUX tokens.',
      'Browser contracts for these feedback examples live in docs/browser/drawer-feedback.spec.ts.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'modal',
    title: 'Modal',
    summary:
      'A blocking dialog for a decision that must be made before work continues. Focus stays inside and returns to the trigger when it closes.',
    antdComponent: 'Modal',
    category: 'Feedback',
    sourceUrl: 'https://ant.design/components/modal/',
    whenToUse: [
      'For a confirmation or short task that must be completed or cancelled before the page can continue.',
      'Prefer Drawer for secondary editing and Popconfirm for a small contextual confirmation.',
    ],
    examples: [
      {
        id: 'decision',
        title: 'Blocking decision',
        description:
          'The page owns open state. Confirm and Cancel close the dialog and report a local outcome; nothing is saved.',
        code: `import { ModalDemo } from '../src/react/FeedbackDemo';

export default function ModalExample() {
  return <ModalDemo documentation />;
}`,
      },
    ],
    apiDescription:
      'The demo island and its GenUX adapter are listed first. Native Ant Design settings follow separately; adapter props are defined in GenUXFeedback.tsx.',
    api: [
      {
        property: 'documentation',
        type: 'boolean',
        defaultValue: 'undefined',
        description:
          'Documentation mode for this local demonstration island. The demo owns its sample state.',
      },
      {
        property: 'GenUXModal',
        type: 'GenUX adapter component · GenUXFeedback.tsx',
        defaultValue: '—',
        description:
          'GenUX adapter export over the native API listed below. Its props follow the adapter source; this page does not restate an unpublished signature.',
      },
    ],
    nativeApi: [
      {
        property: 'open / onOk / onCancel',
        type: 'boolean / function / function',
        defaultValue: 'false / — / —',
        description: 'Controlled visibility and the two close requests. The owner updates open.',
      },
      {
        property: 'title / footer',
        type: 'ReactNode / ReactNode | null',
        defaultValue: '—',
        description: 'Accessible dialog title and footer actions; null removes the default footer.',
      },
      {
        property: 'confirmLoading',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Shows a pending confirmation while the owner performs real work.',
      },
      {
        property: 'centered / width',
        type: 'boolean / number | string',
        defaultValue: 'false / 520',
        description: 'Vertical centering and dialog width within narrow-screen limits.',
      },
      {
        property: 'destroyOnHidden',
        type: 'boolean',
        defaultValue: 'false',
        description:
          'Removes hidden content; drafts inside are lost unless they are owned outside the dialog.',
      },
    ],
    accessibility: [
      'Title every dialog. Focus moves inside on open, stays inside while open and returns to the trigger on close.',
      'Escape and a visible Cancel action close the dialog; destructive confirmations name the consequence.',
      'Keyboard focus uses one visible non-surrounding marker; surrounding focus rings are not used.',
    ],
    notes: [
      'Modal blocks the page; reserve it for decisions that cannot wait.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Readable text stays at least 14 CSS px. Radii, colors and motion come from shared GenUX tokens.',
      'Browser contracts for these feedback examples live in docs/browser/drawer-feedback.spec.ts.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'popconfirm',
    title: 'Popconfirm',
    summary:
      'A small contextual confirmation attached to the action it protects, without leaving the current place.',
    antdComponent: 'Popconfirm',
    category: 'Feedback',
    sourceUrl: 'https://ant.design/components/popconfirm/',
    whenToUse: [
      'For a quick confirmation of a limited risk, such as removing one local item.',
      'Use Modal when the consequence needs explanation or several inputs.',
    ],
    examples: [
      {
        id: 'confirm',
        title: 'Contextual confirmation',
        description:
          'The trigger opens a confirmation beside itself. Confirm and Cancel report a local result only.',
        code: `import { PopconfirmDemo } from '../src/react/FeedbackDemo';

export default function PopconfirmExample() {
  return <PopconfirmDemo documentation />;
}`,
      },
    ],
    apiDescription:
      'The demo island and its GenUX adapter are listed first. Native Ant Design settings follow separately; adapter props are defined in GenUXFeedback.tsx.',
    api: [
      {
        property: 'documentation',
        type: 'boolean',
        defaultValue: 'undefined',
        description:
          'Documentation mode for this local demonstration island. The demo owns its sample state.',
      },
      {
        property: 'GenUXPopconfirm',
        type: 'GenUX adapter component · GenUXFeedback.tsx',
        defaultValue: '—',
        description:
          'GenUX adapter export over the native API listed below. Its props follow the adapter source; this page does not restate an unpublished signature.',
      },
    ],
    nativeApi: [
      {
        property: 'title / description',
        type: 'ReactNode / ReactNode',
        defaultValue: '—',
        description:
          'Main message and supporting detail. Check the installed reference for deprecated aliases.',
      },
      {
        property: 'onConfirm / onCancel',
        type: 'function / function',
        defaultValue: '—',
        description:
          'Called for the confirm and cancel actions. The owner performs any real change.',
      },
      {
        property: 'open / onOpenChange',
        type: 'boolean / (open: boolean) => void',
        defaultValue: 'Uncontrolled',
        description: 'Optional controlled visibility.',
      },
      {
        property: 'placement',
        type: 'top | bottom | left | right and corner variants',
        defaultValue: 'top',
        description: 'Preferred side; the popup adjusts to stay within the viewport.',
      },
      {
        property: 'okText / cancelText / okButtonProps',
        type: 'ReactNode / ReactNode / ButtonProps',
        defaultValue: '—',
        description:
          'Action labels and confirm button settings. Name the consequence in the confirm label.',
      },
    ],
    accessibility: [
      'The trigger keeps its own accessible name. The popup is reachable by keyboard and Escape closes it.',
      'Name the consequence in the question and the confirm action, not with color alone.',
      'Keyboard focus uses one visible non-surrounding marker; surrounding focus rings are not used.',
    ],
    notes: [
      'Popconfirm is contextual and lightweight; it does not replace server-side confirmation or authorization.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Readable text stays at least 14 CSS px. Radii, colors and motion come from shared GenUX tokens.',
      'Browser contracts for these feedback examples live in docs/browser/drawer-feedback.spec.ts.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'date-time',
    title: 'Date and time',
    summary:
      'Choose a day, week, month, quarter, year or moment in time, alone or as a range, with presets and extra information in date cells.',
    antdComponent: 'DatePicker · RangePicker · TimePicker',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/date-picker/',
    whenToUse: [
      'For dates and times where a calendar or time list helps people choose a valid value.',
      'Use ranges for periods, presets for common choices and cell information only when it helps the decision.',
    ],
    examples: [
      {
        id: 'pickers',
        title: 'Pickers, ranges and presets',
        description:
          'The demo owns Dayjs values locally. Granularity, ranges, presets and cell information stay local; nothing is saved.',
        code: `import DateTimeDemo from '../src/react/DateTimeDemo';

export default function DateTimeExample() {
  return <DateTimeDemo documentation />;
}`,
      },
    ],
    apiDescription:
      'DateTimeDemo is a local documentation island built on GenUXDateTime.tsx. Native Ant Design DatePicker settings follow separately; adapter props are defined in its source.',
    api: [
      {
        property: 'documentation',
        type: 'boolean',
        defaultValue: 'undefined',
        description:
          'Documentation mode for this local demonstration island. The demo owns its sample state.',
      },
      {
        property: 'GenUXDateTime.tsx',
        type: 'GenUX adapter module',
        defaultValue: '—',
        description:
          'GenUX adapter export over the native API listed below. Its props follow the adapter source; this page does not restate an unpublished signature.',
      },
    ],
    nativeApi: [
      {
        property: 'picker',
        type: 'date | week | month | quarter | year',
        defaultValue: 'date',
        description: 'Selection granularity. Use showTime or TimePicker for a time of day.',
      },
      {
        property: 'value / onChange',
        type: 'Dayjs | null / (date, dateString) => void',
        defaultValue: '—',
        description: 'Controlled Dayjs value. Clearing returns null.',
      },
      {
        property: 'RangePicker value / onChange',
        type: '[Dayjs, Dayjs] | null / (dates, dateStrings) => void',
        defaultValue: '—',
        description: 'Start and end of a period with the same granularity options.',
      },
      {
        property: 'showTime / format',
        type: 'boolean | object / string',
        defaultValue: 'false / —',
        description: 'Adds time selection and controls the displayed text format.',
      },
      {
        property: 'presets',
        type: '{ label: ReactNode; value: Dayjs | (() => Dayjs) }[]',
        defaultValue: '—',
        description: 'Common choices beside the calendar; ranges use start and end pairs.',
      },
      {
        property: 'cellRender / disabledDate',
        type: '(current, info) => ReactNode / (current) => boolean',
        defaultValue: '—',
        description:
          'Adds information to date cells or prevents unavailable dates. Information must not rely on color alone.',
      },
    ],
    accessibility: [
      'Each picker has a visible label. Typed input, arrow keys, Enter and Escape remain available alongside the calendar.',
      'Explain unavailable dates and cell information in text, not only with color or marks.',
      'Keyboard focus uses one visible non-surrounding marker; surrounding focus rings are not used.',
    ],
    notes: [
      'Values are Dayjs objects owned by the example. Time zones and server formats belong to the consuming application.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Readable text stays at least 14 CSS px. Radii, colors and motion come from shared GenUX tokens.',
      'Browser acceptance for date and time examples belongs to the docs/browser suites.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
];
