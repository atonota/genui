import type { Meta, StoryObj } from '@storybook/react-vite';
import InputDemo from '../docs/src/react/InputDemo';

const meta = {
  title: 'Components/Input',
  component: InputDemo,
  args: { numberMode: 'spinner' },
  parameters: { controls: { disable: true }, genuxSharedPreview: true },
} satisfies Meta<typeof InputDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
