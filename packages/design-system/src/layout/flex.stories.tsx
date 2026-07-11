import type { Meta, StoryObj } from '@storybook/react-vite';

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
  argTypes: {
    direction: {
      control: 'inline-radio',
      options: ['row', 'column'],
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
  },
  args: { gap: 4, align: 'center', justify: 'start' },
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
