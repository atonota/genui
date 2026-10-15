import type { Meta, StoryObj } from '@storybook/react-vite';
import AccordionDemo from '../docs/src/react/AccordionDemo';

const meta = {
  title: 'Components/Accordion',
  component: AccordionDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof AccordionDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { name: 'Variants' };
