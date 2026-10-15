import type { Meta, StoryObj } from '@storybook/react-vite';
import ButtonDemo from '../docs/src/react/ButtonDemo';
import ApprovedButtonStates from '../docs/src/react/ButtonStates';
import ApprovedButtonDimensions from '../docs/src/react/ButtonDimensions';
import ApprovedButtonVisuals from '../docs/src/react/ButtonVisualDecisions';
import AtlasLayeredButton from '../docs/src/react/AtlasLayeredButton';
import AtlasProvider from '../docs/src/react/AtlasProvider';

const meta = {
  title: 'Components/Button',
  component: ButtonDemo,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ButtonDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { name: 'Playground' };

export const ApprovedStates: Story = {
  name: 'Approved states',
  render: () => <ApprovedButtonStates />,
};

export const ApprovedDimensions: Story = {
  name: 'Approved sizes and widths',
  render: () => <ApprovedButtonDimensions />,
};

export const ApprovedVisuals: Story = {
  name: 'Approved appearances',
  render: () => <ApprovedButtonVisuals />,
};

export const LayeredFlatEight: Story = {
  name: 'Layered flat · 8 px',
  render: () => (
    <AtlasProvider>
      <AtlasLayeredButton />
    </AtlasProvider>
  ),
};
