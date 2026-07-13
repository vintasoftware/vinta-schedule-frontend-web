import type { Meta, StoryObj } from '../story-types';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
} from './carousel';

/**
 * CarouselNext — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the button reads
 * `scrollNext`/`canScrollNext` from the Carousel root's context via
 * `useCarousel()` and THROWS outside it. The contract extractor still reads
 * it (it only looks at title / argTypes / parameters.puck), so the composer
 * can bind and compose CarouselNext.
 */
const meta = {
  title: 'Components/CarouselNext',
  component: CarouselNext,
  tags: ['!dev'],
  // Leaf: forwards Button's real `variant`/`size` props, no composed children.
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'default', 'lg', 'xl', 'icon'],
    },
  },
  args: {},
} satisfies Meta<typeof CarouselNext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Carousel className='w-64'>
      <CarouselContent>
        <CarouselItem>1</CarouselItem>
      </CarouselContent>
      <CarouselNext {...args} />
    </Carousel>
  ),
};
