// Metadata consumed by the Theme Builder UI. English is canonical; every
// English string below has a Turkish entry in `translations` for useI18n.

import { tokenDefinitions } from './model';

// Inset and spacing scales show the documented default recipe straight from the
// token definitions, so this table cannot drift from them. A missing or
// ambiguous sm/md/lg token fails loudly instead of showing a guessed value.
const SCALE_SIZES = ['sm', 'md', 'lg'] as const;

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function defaultScale(...words: readonly string[]): string {
  let unit = '';
  const values = SCALE_SIZES.map(size => {
    const matches = tokenDefinitions.filter(definition =>
      [definition.id, String(definition.css)].some(name => {
        const normalised = normaliseName(name);
        return normalised.endsWith(size) && words.every(word => normalised.includes(word));
      }),
    );
    const [match] = matches;
    if (!match || matches.length !== 1) {
      throw new Error(
        `Theme Builder metadata: expected one ${words.join(' ')} ${size} token, found ${matches.length}`,
      );
    }
    unit = match.unit ?? '';
    return String(match.defaults.light);
  });
  return `${values.join(' / ')}${unit}`;
}

export const stateAxes = [
  {
    id: 'availability',
    label: 'Availability',
    description:
      'Native disabled attribute. Removes the control from interaction; never used for read-only or processing.',
    values: ['enabled', 'disabled'],
  },
  {
    id: 'editability',
    label: 'Editability',
    description: 'Native readOnly attribute. The value stays focusable, selectable and submitted.',
    values: ['editable', 'read-only'],
  },
  {
    id: 'pointer',
    label: 'Pointer',
    description:
      'Hover and active pseudo-classes. Feedback only; hover is never the only path to an action.',
    values: ['idle', 'hover', 'pressed'],
  },
  {
    id: 'focus',
    label: 'Focus',
    description:
      'Focus-visible pseudo-class. Shows an instant bottom-only indicator, never an enclosing ring.',
    values: ['unfocused', 'focus-visible'],
  },
  {
    id: 'selection',
    label: 'Selection',
    description:
      'Native checked and indeterminate, or aria-checked and aria-selected on custom roles.',
    values: ['unselected', 'selected', 'mixed'],
  },
  {
    id: 'disclosure',
    label: 'Disclosure',
    description: 'aria-expanded on the trigger of a collapsible section or open panel.',
    values: ['collapsed', 'expanded'],
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Field-level aria-invalid with a message linked by aria-describedby. Not a generic server error.',
    values: ['unvalidated', 'validating', 'valid', 'invalid'],
  },
  {
    id: 'operation',
    label: 'Operation',
    description:
      'aria-busy while a local action runs. The control stays enabled; processing is not disabled.',
    values: ['idle', 'loading', 'submitting', 'succeeded', 'failed'],
  },
  {
    id: 'dirty',
    label: 'Unsaved changes',
    description: 'The draft differs from the applied theme. Changes stay local until Apply theme.',
    values: ['pristine', 'dirty', 'saving', 'saved'],
  },
] as const;

export const measurementPolicy = [
  {
    label: 'Base rhythm',
    value: '4px',
    description: 'Spacing, insets and control heights are multiples of 4 CSS px.',
  },
  {
    label: 'Control inset',
    value: defaultScale('inset', 'control'),
    description: 'Small, medium and large padding inside controls.',
  },
  {
    label: 'Container inset',
    value: defaultScale('inset', 'container'),
    description: 'Small, medium and large padding inside panels and sections.',
  },
  {
    label: 'Page inset',
    value: defaultScale('inset', 'page'),
    description: 'Small, medium and large page gutters as available width grows.',
  },
  {
    label: 'Local spacing',
    value: defaultScale('spac', 'local'),
    description: 'Gaps between related items inside one group.',
  },
  {
    label: 'Section spacing',
    value: defaultScale('spac', 'section'),
    description: 'Gaps between groups inside one section.',
  },
  {
    label: 'Layout spacing',
    value: defaultScale('spac', 'layout'),
    description: 'Gaps between page regions.',
  },
  {
    label: 'Shared inset scale',
    value: 'margin = padding',
    description:
      'The same inset values drive margin and padding; there is no separate margin scale.',
  },
  {
    label: 'Units',
    value: 'CSS px',
    description:
      'Measurements are fixed CSS px; the browser root size and zoom are left untouched.',
  },
  {
    label: 'Typography',
    value: 'Outfit 400 / 300',
    description: 'Text uses Outfit at weight 400; lighter weights never go below 300.',
  },
  {
    label: 'Minimum text size',
    value: '14px',
    description:
      'All readable text, including labels, badges and errors, computes to at least 14 CSS px.',
  },
  {
    label: 'Control heights',
    value: '48 / 56 / 64px',
    description: 'Small, medium and large interactive targets.',
  },
  {
    label: 'Handles',
    value: '32px',
    description: 'Minimum size for slider and switch handles.',
  },
  {
    label: 'Radii',
    value: '0 / 3 / 5 / 8px',
    description: 'Fixed square corner plus the small, medium and large radius tokens.',
  },
  {
    label: 'Pill and circle',
    value: '9999px / 100%',
    description:
      '9999px makes a capsule with straight sides; 100% is only for true circles with equal width and height.',
  },
  {
    label: 'Text field profile',
    value: 'light / dark',
    description:
      'Field colors come from central tokens per mode; the field is darker than the panel in both modes and text contrast stays at least 4.5:1.',
  },
  {
    label: 'Motion',
    value: 'cubic-bezier(.65, 0, .35, 1)',
    description:
      'Locked Cubic easing with the existing positive durations in both directions; reduced motion is respected.',
  },
  {
    label: 'Keyboard focus',
    value: 'bottom indicator',
    description: 'Focus appears immediately as a bottom-only indicator; no enclosing ring.',
  },
] as const;

export const layerOrder = [
  { id: 'header', label: 'Fixed header', value: 100 },
  { id: 'dropdown', label: 'Dropdown', value: 1000 },
  { id: 'drawer', label: 'Drawer', value: 1100 },
  { id: 'modal', label: 'Modal', value: 1200 },
  { id: 'popconfirm', label: 'Popconfirm', value: 1300 },
  { id: 'toast', label: 'Toast', value: 1400 },
] as const;

export const surfaceRecipes = [
  {
    id: 'flat',
    label: 'Flat',
    description:
      'Panel color with no border or shadow; separation comes from spacing and alignment.',
  },
  {
    id: 'inset',
    label: 'Inset',
    description: 'Field color darker than the panel; a functional border marks the input boundary.',
  },
  {
    id: 'raised',
    label: 'Raised',
    description:
      'Overlays only. Elevation comes from the theme shadow tokens and is separate from layer order.',
  },
] as const;

export const translations: Readonly<Record<string, string>> = {
  // State axes
  Availability: 'Kullanılabilirlik',
  'Native disabled attribute. Removes the control from interaction; never used for read-only or processing.':
    'Yerel disabled özniteliği. Kontrolü etkileşimden çıkarır; salt okunur veya işlem sürerken kullanılmaz.',
  enabled: 'etkin',
  disabled: 'devre dışı',
  Editability: 'Düzenlenebilirlik',
  'Native readOnly attribute. The value stays focusable, selectable and submitted.':
    'Yerel readOnly özniteliği. Değer odaklanabilir, seçilebilir kalır ve gönderilir.',
  editable: 'düzenlenebilir',
  'read-only': 'salt okunur',
  Pointer: 'İşaretçi',
  'Hover and active pseudo-classes. Feedback only; hover is never the only path to an action.':
    'Hover ve active sözde sınıfları. Yalnızca geri bildirimdir; üzerine gelme hiçbir eylemin tek yolu değildir.',
  idle: 'boşta',
  hover: 'üzerinde',
  pressed: 'basılı',
  Focus: 'Odak',
  'Focus-visible pseudo-class. Shows an instant bottom-only indicator, never an enclosing ring.':
    'Focus-visible sözde sınıfı. Anında yalnızca alt göstergeyi gösterir, asla çevreleyen halka kullanmaz.',
  unfocused: 'odaksız',
  'focus-visible': 'görünür odak',
  Selection: 'Seçim',
  'Native checked and indeterminate, or aria-checked and aria-selected on custom roles.':
    'Yerel checked ve indeterminate ya da özel rollerde aria-checked ve aria-selected.',
  unselected: 'seçili değil',
  selected: 'seçili',
  mixed: 'karışık',
  Disclosure: 'Açılım',
  'aria-expanded on the trigger of a collapsible section or open panel.':
    'Daraltılabilir bölümün veya açık panelin tetikleyicisinde aria-expanded.',
  collapsed: 'daraltılmış',
  expanded: 'genişletilmiş',
  Validation: 'Doğrulama',
  'Field-level aria-invalid with a message linked by aria-describedby. Not a generic server error.':
    'Alan düzeyinde aria-invalid ve aria-describedby ile bağlı mesaj. Genel bir sunucu hatası değildir.',
  unvalidated: 'doğrulanmamış',
  validating: 'doğrulanıyor',
  valid: 'geçerli',
  invalid: 'geçersiz',
  Operation: 'İşlem',
  'aria-busy while a local action runs. The control stays enabled; processing is not disabled.':
    'Yerel eylem sürerken aria-busy. Kontrol etkin kalır; işlem sürmesi devre dışı anlamına gelmez.',
  loading: 'yükleniyor',
  submitting: 'gönderiliyor',
  succeeded: 'başarılı',
  failed: 'başarısız',
  'Unsaved changes': 'Kaydedilmemiş değişiklikler',
  'The draft differs from the applied theme. Changes stay local until Apply theme.':
    'Taslak uygulanan temadan farklı. Değişiklikler Temayı uygula seçilene kadar yerel kalır.',
  pristine: 'değişmemiş',
  dirty: 'değişmiş',
  saving: 'kaydediliyor',
  saved: 'kaydedildi',

  // Measurement policy
  'Base rhythm': 'Temel ritim',
  'Spacing, insets and control heights are multiples of 4 CSS px.':
    'Boşluklar, iç boşluklar ve kontrol yükseklikleri 4 CSS px katlarıdır.',
  'Control inset': 'Kontrol iç boşluğu',
  'Small, medium and large padding inside controls.':
    'Kontrollerin içinde küçük, orta ve büyük iç boşluk.',
  'Container inset': 'Kapsayıcı iç boşluğu',
  'Small, medium and large padding inside panels and sections.':
    'Paneller ve bölümler içinde küçük, orta ve büyük iç boşluk.',
  'Page inset': 'Sayfa iç boşluğu',
  'Small, medium and large page gutters as available width grows.':
    'Kullanılabilir genişlik arttıkça küçük, orta ve büyük sayfa kenar boşlukları.',
  'Local spacing': 'Yerel aralık',
  'Gaps between related items inside one group.':
    'Bir grup içindeki ilişkili öğeler arasındaki aralıklar.',
  'Section spacing': 'Bölüm aralığı',
  'Gaps between groups inside one section.': 'Bir bölüm içindeki gruplar arasındaki aralıklar.',
  'Layout spacing': 'Yerleşim aralığı',
  'Gaps between page regions.': 'Sayfa bölgeleri arasındaki aralıklar.',
  'Shared inset scale': 'Ortak iç boşluk ölçeği',
  'margin = padding': 'dış boşluk = iç boşluk',
  'The same inset values drive margin and padding; there is no separate margin scale.':
    'Aynı iç boşluk değerleri hem dış hem iç boşluğu belirler; ayrı bir dış boşluk ölçeği yoktur.',
  Units: 'Birimler',
  'Measurements are fixed CSS px; the browser root size and zoom are left untouched.':
    'Ölçüler sabit CSS px’tir; tarayıcı kök boyutu ve yakınlaştırma değiştirilmez.',
  Typography: 'Tipografi',
  'Text uses Outfit at weight 400; lighter weights never go below 300.':
    'Metin 400 kalınlıkta Outfit kullanır; daha ince kalınlıklar 300’ün altına inmez.',
  'Minimum text size': 'Minimum metin boyutu',
  'All readable text, including labels, badges and errors, computes to at least 14 CSS px.':
    'Etiketler, rozetler ve hatalar dahil tüm okunabilir metin en az 14 CSS px olarak hesaplanır.',
  'Control heights': 'Kontrol yükseklikleri',
  'Small, medium and large interactive targets.': 'Küçük, orta ve büyük etkileşim hedefleri.',
  Handles: 'Tutamaçlar',
  'Minimum size for slider and switch handles.':
    'Kaydırıcı ve anahtar tutamaçları için minimum boyut.',
  Radii: 'Köşe yarıçapları',
  'Fixed square corner plus the small, medium and large radius tokens.':
    'Sabit keskin köşe ile küçük, orta ve büyük yarıçap tokenları.',
  'Pill and circle': 'Kapsül ve daire',
  '9999px makes a capsule with straight sides; 100% is only for true circles with equal width and height.':
    '9999px düz kenarlı bir kapsül oluşturur; %100 yalnızca genişliği ve yüksekliği eşit gerçek daireler içindir.',
  'Text field profile': 'Metin alanı profili',
  'light / dark': 'açık / koyu',
  'Field colors come from central tokens per mode; the field is darker than the panel in both modes and text contrast stays at least 4.5:1.':
    'Alan renkleri her mod için merkezi tokenlardan gelir; alan iki modda da panelden koyudur ve metin kontrastı en az 4.5:1 kalır.',
  Motion: 'Hareket',
  'Locked Cubic easing with the existing positive durations in both directions; reduced motion is respected.':
    'İki yönde mevcut pozitif sürelerle kilitli Cubic yumuşatma; azaltılmış hareket tercihine uyulur.',
  'Keyboard focus': 'Klavye odağı',
  'bottom indicator': 'alt gösterge',
  'Focus appears immediately as a bottom-only indicator; no enclosing ring.':
    'Odak anında yalnızca alt gösterge olarak görünür; çevreleyen halka yoktur.',

  // Layer order
  'Fixed header': 'Sabit üst bilgi',
  Dropdown: 'Açılır menü',
  Drawer: 'Çekmece',
  Modal: 'Modal',
  Popconfirm: 'Onay balonu',
  Toast: 'Bildirim',

  // Surface recipes
  Flat: 'Düz',
  'Panel color with no border or shadow; separation comes from spacing and alignment.':
    'Kenarlık ve gölge olmadan panel rengi; ayrım boşluk ve hizalamayla sağlanır.',
  Inset: 'Gömme',
  'Field color darker than the panel; a functional border marks the input boundary.':
    'Panelden koyu alan rengi; işlevsel kenarlık giriş sınırını belirtir.',
  Raised: 'Yükseltilmiş',
  'Overlays only. Elevation comes from the theme shadow tokens and is separate from layer order.':
    'Yalnızca katmanlar için. Yükselti tema gölge tokenlarından gelir ve katman sırasından ayrıdır.',
};
