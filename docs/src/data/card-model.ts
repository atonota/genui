/** Serializable presentation contracts; domain access and callbacks remain with the host. */
export const CARD_PURPOSES = [
  'entity',
  'metric',
  'action',
  'selection',
  'summary',
  'status',
  'task',
  'product',
  'profile',
  'pricing',
  'content',
  'media',
  'form',
  'notification',
  'insight',
  'ai-response',
  'workflow',
  'integration',
  'activity',
  'empty',
  'widget',
  'announcement',
  'help',
] as const;
export type CardPurpose = (typeof CARD_PURPOSES)[number];
export type CardValue = string | number | boolean | null;
export type CardDataState = 'ready' | 'loading' | 'empty' | 'partial' | 'error' | 'disabled';
export type CardTone = 'default' | 'success' | 'processing' | 'warning' | 'error';
export type CardIntent =
  | 'inspect'
  | 'select'
  | 'move'
  | 'retry'
  | 'create'
  | 'connect'
  | 'review'
  | 'open';
export interface CardAction {
  id: string;
  label: string;
  intent: CardIntent;
  disabled?: boolean;
  reason?: string;
}
export interface CardFact {
  key: string;
  label: string;
  value: CardValue;
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date';
  currency?: string;
}
export interface CardSource {
  label: string;
  sourceId: string;
  observedAt: string;
  mode: 'recorded' | 'host' | 'user';
}
export interface CardMedia {
  kind: 'monogram' | 'symbol';
  label: string;
  symbol?: 'place' | 'vehicle' | 'person' | 'product' | 'document' | 'course' | 'media';
}
export interface CardMetric {
  value: number | null;
  label: string;
  unit?: string;
  currency?: string;
  period: string;
  delta?: number | null;
  comparison?: string;
  meaning?: 'positive' | 'negative' | 'neutral';
}
export interface CardItem {
  id: string;
  title: string;
  detail?: string;
  state?: 'pending' | 'active' | 'complete';
}
export interface CardField {
  key: string;
  label: string;
  value: string;
  required?: boolean;
  readOnly?: boolean;
  error?: string;
}
export interface GenUXCardModel {
  id: string;
  kind: CardPurpose;
  title: string;
  description?: string;
  eyebrow?: string;
  status?: { label: string; tone: CardTone; colorIndex?: number };
  media?: CardMedia;
  facts?: readonly CardFact[];
  items?: readonly CardItem[];
  primaryAction?: CardAction;
  secondaryActions?: readonly CardAction[];
  source?: CardSource;
  state?: CardDataState;
  stateMessage?: string;
  layout?: 'vertical' | 'horizontal' | 'auto';
  density?: 'compact' | 'comfortable';
  metric?: CardMetric;
  metrics?: readonly (CardMetric & { id: string })[];
  selection?: { mode: 'single' | 'multiple'; selected: boolean; group: string };
  task?: {
    lane: 'planned' | 'active' | 'done';
    priority: 'low' | 'normal' | 'high';
    completed: number;
    total: number;
  };
  pricing?: { amount: number; currency: string; interval: string; features: readonly string[] };
  fields?: readonly CardField[];
  file?: { name: string; mime: string; sizeBytes: number; durationSeconds?: number };
  connection?: 'available' | 'connected' | 'unavailable';
  details?: { heading: string; body: string };
}
export interface GenUXCardCallbacks {
  onAction?: (action: CardAction, model: GenUXCardModel) => void;
  onSelectionChange?: (selected: boolean, model: GenUXCardModel) => void;
  onMove?: (lane: NonNullable<GenUXCardModel['task']>['lane'], model: GenUXCardModel) => void;
  onFieldChange?: (key: string, value: string, model: GenUXCardModel) => void;
}
