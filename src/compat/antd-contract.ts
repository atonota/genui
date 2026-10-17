import type {
  ButtonProps,
  Checkbox,
  CheckboxProps,
  ConfigProviderProps,
  GetProps,
  Input,
  InputNumberProps,
  InputProps,
  RadioGroupProps,
  RadioProps,
  SelectProps,
  SwitchProps,
} from 'antd';

/** Compile-time compatibility only; the standalone preview does not render React. */
export type AntdButtonRecipe = {
  configProvider: ConfigProviderProps;
  button: {
    props: ButtonProps;
    styles: ButtonProps['styles'];
  };
};

/** Public props for the components named by FORM_EXPERIMENTS.mapping. */
export type AntdFormProps = {
  Input: InputProps;
  'Input.Search': GetProps<typeof Input.Search>;
  'Input.Password': GetProps<typeof Input.Password>;
  InputNumber: InputNumberProps;
  'Input.TextArea': GetProps<typeof Input.TextArea>;
  Select: SelectProps<string | string[]>;
  Checkbox: CheckboxProps;
  'Checkbox.Group': GetProps<typeof Checkbox.Group>;
  Radio: RadioProps;
  'Radio.Group': RadioGroupProps;
  Switch: SwitchProps;
};

// Intentionally component-specific: Switch has no large size; Checkbox and Radio
// have no size prop. Custom genux dimensions remain project CSS, not invented APIs.
export const antdFormPropsContract = {
  Input: {
    size: 'medium',
    variant: 'outlined',
    status: 'warning',
    allowClear: true,
    readOnly: false,
    disabled: false,
  },
  'Input.Search': { size: 'medium', allowClear: true },
  'Input.Password': { size: 'medium', visibilityToggle: true },
  InputNumber: { size: 'medium', min: 0, max: 99 },
  'Input.TextArea': {
    variant: 'filled',
    autoSize: { minRows: 3 },
    maxLength: 240,
    showCount: true,
  },
  Select: {
    size: 'medium',
    variant: 'underlined',
    mode: 'multiple',
    showSearch: true,
    allowClear: true,
    options: [
      { value: 'istanbul', label: 'İstanbul' },
      { value: 'antalya', label: 'Antalya', disabled: true },
    ],
  },
  Checkbox: { indeterminate: true, disabled: false },
  'Checkbox.Group': { options: ['E-posta', 'SMS'], value: ['E-posta'] },
  Radio: { value: 'daily', disabled: false },
  'Radio.Group': {
    size: 'medium',
    orientation: 'horizontal',
    optionType: 'button',
    buttonStyle: 'solid',
    options: ['Anında', 'Günlük', 'Haftalık'],
  },
  Switch: { size: 'medium', checked: true, loading: true, disabled: true },
} satisfies AntdFormProps;
