/**
 * Layout kit — compose UIs from props, not classes.
 *
 * Primitives:   Box · Flex · HStack · VStack · Stack · Grid · GridItem ·
 *               Center · Spacer · Section · Divider · Container · FormLayout
 * Typography:   Text · Heading
 * Composition:  Navbar · AppTopbar · PageHeader
 * Shells:       AppShell · AuthLayout
 */

// Primitives
export { Box, type BoxProps } from './box';
export { Flex, HStack, VStack, type FlexProps, type StackProps } from './flex';
export { Stack } from './stack';
export { Grid, GridItem, type GridProps, type GridItemProps } from './grid';
export { Center } from './center';
export { Spacer } from './spacer';
export { Section, type SectionProps } from './section';
export { Divider, type DividerProps } from './divider';
export { VisuallyHidden, type VisuallyHiddenProps } from './visually-hidden';
export { Container, type ContainerProps } from './container';
export { FormLayout, type FormLayoutProps } from './form-layout';

// Typography
export {
  Text,
  type TextProps,
  type TextSize,
  type TextWeight,
  type TextFamily,
} from './text';
export { Heading, type HeadingProps } from './heading';

// Style-prop vocabulary
export type {
  Space,
  Radius,
  Shadow,
  ColorToken,
  Size,
  BoxStyleProps,
} from './layout-style';

// Responsive props — padding/display/textAlign on every primitive, plus Flex's
// direction/align/justify/gap and Grid's columns/gap, accept a per-breakpoint
// object: `<Grid columns={{ base: 1, md: 2, lg: 3 }} />`.
export type { Breakpoint, Responsive } from './responsive';

// Composition + shells
export { Navbar, BrandMark, type NavbarProps } from './navbar';
export { AppTopbar, type AppTopbarProps } from './app-topbar';
export { PageHeader, type PageHeaderProps } from './page-header';
export { AppShell, type AppShellProps } from './app-shell';
export { AuthLayout, type AuthLayoutProps } from './auth-layout';
