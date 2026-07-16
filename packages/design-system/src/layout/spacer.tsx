import * as React from 'react';

/**
 * Spacer — flexible gap that pushes siblings apart inside a Flex/HStack/VStack.
 *
 * ```tsx
 * <HStack><Logo /><Spacer /><Actions /></HStack>
 * ```
 */
const Spacer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Spacer({ style, ...props }, ref) {
  return (
    <div
      ref={ref}
      aria-hidden
      style={{ flex: '1 1 0%', alignSelf: 'stretch', ...style }}
      {...props}
    />
  );
});

export { Spacer };
