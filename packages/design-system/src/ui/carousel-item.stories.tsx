import type { Meta, StoryObj } from '../story-types';

import { Carousel, CarouselContent, CarouselItem } from './carousel';

/**
 * CarouselItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a slide reads
 * `orientation` from the Carousel root's context via `useCarousel()` and
 * THROWS outside it. The contract extractor still reads it (it only looks at
 * title / argTypes / parameters.puck), so the composer can bind and compose
 * CarouselItem.
 */
const meta = {
  title: 'Components/CarouselItem',
  component: CarouselItem,
  tags: ['!dev'],
  // Slide content is arbitrary — any component may fill a slide, so the slot
  // is left UNRESTRICTED (bare string).
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof CarouselItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Carousel className='w-64'>
      <CarouselContent>
        <CarouselItem {...args}>Slide content</CarouselItem>
      </CarouselContent>
    </Carousel>
  ),
};
