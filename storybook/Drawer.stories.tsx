import type { Meta, StoryObj } from '@storybook/react-vite';
import DrawerDemo from '../docs/src/react/DrawerDemo';

const meta = {
  title: 'Components/Drawer',
  component: DrawerDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof DrawerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
