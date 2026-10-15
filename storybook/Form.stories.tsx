import type { Meta, StoryObj } from '@storybook/react-vite';
import FormDemo from '../docs/src/react/FormDemo';

const meta = {
  title: 'Components/Form',
  component: FormDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof FormDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
