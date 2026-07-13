import type { Meta, StoryObj } from '../story-types';

import { Carousel, CarouselContent, CarouselItem } from './carousel';

/**
 * CarouselContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the content
 * viewport reads `carouselRef`/`orientation` from the Carousel root's
 * context via `useCarousel()` and THROWS outside it. The contract extractor
 * still reads it (it only looks at title / argTypes / parameters.puck), so
 * the composer can bind and compose CarouselContent.
 */
const meta = {
  title: 'Components/CarouselContent',
  component: CarouselContent,
  tags: ['!dev'],
  // Container: content holds CarouselItems, so `children` is a slot and must
  // not also be an argType (§9). It has no other props of its own.
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['CarouselItem'] }] },
  },
} satisfies Meta<typeof CarouselContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Carousel className='w-64'>
      <CarouselContent {...args}>
        <CarouselItem>1</CarouselItem>
        <CarouselItem>2</CarouselItem>
      </CarouselContent>
    </Carousel>
  ),
};
