import type { Meta, StoryObj } from '../story-types';

import { Flex, HStack, VStack } from './flex';
import { Box } from './box';
import { Spacer } from './spacer';
import { Center } from './center';
import { Divider } from './divider';
import { Button } from '../ui/button';

const meta = {
  title: 'Layout/Flex',
  component: Flex,
  tags: ['autodocs'],
  // FlexProps = flex vocabulary (direction/align/justify/wrap/gap) + the shared
  // BoxStyleProps. A useful subset is curated; `children` is the composed
  // content slot (§3) and `className`/`style` stay unexposed (§6).
  argTypes: {
    direction: {
      control: 'inline-radio',
      options: ['row', 'column', 'row-reverse', 'column-reverse'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    gap: { control: 'select', options: [0, 2, 4, 6, 8] },
    wrap: { control: 'boolean' },
    inline: { control: 'boolean' },
    p: { control: 'select', options: [0, 2, 4, 6, 8] },
    bg: {
      control: 'select',
      options: ['background', 'card', 'muted', 'accent'],
    },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
    },

    // Per-breakpoint direction — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    directionSm: { control: 'select', options: ['row', 'column'] },
    directionMd: { control: 'select', options: ['row', 'column'] },
    directionLg: { control: 'select', options: ['row', 'column'] },
    directionXl: { control: 'select', options: ['row', 'column'] },
    // Per-breakpoint gap — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    gapSm: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapMd: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapLg: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapXl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    // Per-breakpoint align — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    alignSm: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignMd: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignLg: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignXl: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    // Per-breakpoint justify — one dropdown per breakpoint, so the
    // composer can author responsive values (not just the base).
    justifySm: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyMd: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyLg: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyXl: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },

    // ---- Container queries -------------------------------------------------
    // React to an ANCESTOR's width instead of the viewport. Declare a container
    // with `asContainer`, then point `container` at it and set the Cq* values.
    asContainer: {
      control: 'select',
      options: ['app', 'content', 'nav', 'topbar', 'pageheader'],
      description: 'Make THIS element a named container others can respond to',
    },
    container: {
      control: 'select',
      options: ['app', 'content', 'nav', 'topbar', 'pageheader'],
      description: 'Which ancestor container the Cq* values below respond to',
    },
    // Per-container-size direction.
    directionCqMd: { control: 'select', options: ['row', 'column'] },
    directionCqLg: { control: 'select', options: ['row', 'column'] },
    directionCqXl: { control: 'select', options: ['row', 'column'] },
    directionCq2xl: { control: 'select', options: ['row', 'column'] },
    directionCq3xl: { control: 'select', options: ['row', 'column'] },
    directionCq4xl: { control: 'select', options: ['row', 'column'] },
    // Per-container-size gap.
    gapCqMd: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCqLg: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCqXl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCq2xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCq3xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    gapCq4xl: {
      control: 'select',
      options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    // Per-container-size align.
    alignCqMd: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignCqLg: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignCqXl: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignCq2xl: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignCq3xl: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    alignCq4xl: {
      control: 'select',
      options: ['start', 'center', 'end', 'stretch', 'baseline'],
    },
    // Per-container-size justify.
    justifyCqMd: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyCqLg: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyCqXl: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyCq2xl: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyCq3xl: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    justifyCq4xl: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
  },
  args: { gap: 4, align: 'center', justify: 'start' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof Flex>;

export default meta;
type Story = StoryObj<typeof meta>;

const Item = ({ children }: { children: React.ReactNode }) => (
  <Box bg='vinta-50' color='vinta-700' px={4} py={2} radius='md'>
    {children}
  </Box>
);

export const Playground: Story = {
  render: (args) => (
    <Flex {...args}>
      <Item>One</Item>
      <Item>Two</Item>
      <Item>Three</Item>
    </Flex>
  ),
};

export const SpaceBetween: Story = {
  name: 'HStack + Spacer (toolbar)',
  render: () => (
    <HStack gap={3} p={3} bg='card' radius='lg' border>
      <Item>Logo</Item>
      <Spacer />
      <Button variant='ghost' size='sm'>
        Settings
      </Button>
      <Button size='sm'>New</Button>
    </HStack>
  ),
};

export const Stacks: Story = {
  render: () => (
    <Flex gap={8} align='start'>
      <VStack gap={2}>
        <Item>VStack 1</Item>
        <Item>VStack 2</Item>
        <Item>VStack 3</Item>
      </VStack>
      <Divider orientation='vertical' />
      <HStack gap={2}>
        <Item>HStack 1</Item>
        <Item>HStack 2</Item>
      </HStack>
    </Flex>
  ),
};

export const CenterAndDivider: Story = {
  render: () => (
    <VStack gap={4}>
      <Center bg='muted' radius='lg' height={120}>
        <Item>Centered</Item>
      </Center>
      <Divider />
      <Center bg='muted' radius='lg' height={80}>
        <span className='text-muted-foreground text-sm'>Below the divider</span>
      </Center>
    </VStack>
  ),
};
