import type { Meta, StoryObj } from '@storybook/react-vite';
import SelectDemo from '../docs/src/react/SelectDemo';

const meta = {
  title: 'Components/Select',
  component: SelectDemo,
  args: { pillTags: true },
  parameters: { controls: { disable: true }, genuxSharedPreview: true },
} satisfies Meta<typeof SelectDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
