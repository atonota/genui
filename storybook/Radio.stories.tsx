import type { Meta, StoryObj } from '@storybook/react-vite';
import RadioDemo from '../docs/src/react/RadioDemo';

const meta = {
  title: 'Components/Radio',
  component: RadioDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof RadioDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
