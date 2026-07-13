import type { Meta, StoryObj } from '../story-types';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel';
import { Card, CardContent } from './card';

const meta = {
  title: 'Components/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  // `orientation` and `opts` are the real editable props on CarouselProps
  // (`plugins`/`setApi` are functions/instances — not curatable). `children` is
  // the composed slide content → slot (§4), never also an argType (§5).
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
    opts: {
      control: 'object',
      description:
        'Embla carousel options (e.g. { loop: true, align: "start" })',
    },
  },
  args: { orientation: 'horizontal' },
  // A carousel composes its scrollable content plus the prev/next controls —
  // nothing else belongs directly under the root.
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: ['CarouselContent', 'CarouselPrevious', 'CarouselNext'],
        },
      ],
    },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Carousel className='w-64' {...args}>
      <CarouselContent>
        {Array.from({ length: 5 }).map((_, i) => (
          <CarouselItem key={i}>
            <Card>
              <CardContent className='flex h-32 items-center justify-center p-6 text-3xl font-semibold'>
                {i + 1}
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
