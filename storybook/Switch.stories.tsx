import type { Meta, StoryObj } from '@storybook/react-vite';
import SwitchDemo from '../docs/src/react/SwitchDemo';

const meta = {
  title: 'Components/Switch',
  component: SwitchDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof SwitchDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
