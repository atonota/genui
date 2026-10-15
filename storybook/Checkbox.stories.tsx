import type { Meta, StoryObj } from '@storybook/react-vite';
import CheckboxDemo from '../docs/src/react/CheckboxDemo';

const meta = {
  title: 'Components/Checkbox',
  component: CheckboxDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof CheckboxDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
