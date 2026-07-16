'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Box, Text } from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { useEffect, useState } from 'react';

/**
 * The sun/moon pair cross-fades on the `dark` class: both glyphs are stacked and
 * only one is scaled in. That is a `dark:` variant + a rotation transition, which
 * no DS prop expresses, so the two icons keep their utility classes.
 */
// TODO(ds-gap): <Icon> has no dark-mode / transform variants — the crossfade
// below (scale + rotate under `dark:`) cannot be expressed with props.
const SUN_CLASS =
  'h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90';
const MOON_CLASS =
  'absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <Button size='icon' disabled>
        <Box width='1.2rem' height='1.2rem' />
        {/* TODO(ds-gap): no VisuallyHidden primitive — `sr-only` has no prop. */}
        <Text as='span' className='sr-only'>
          Toggle theme
        </Text>
      </Button>
    );
  }

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  };

  return (
    <Button
      size='icon'
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Sun className={SUN_CLASS} />
      <Moon className={MOON_CLASS} />
      {/* TODO(ds-gap): no VisuallyHidden primitive — `sr-only` has no prop. */}
      <Text as='span' className='sr-only'>
        Toggle theme
      </Text>
    </Button>
  );
}
