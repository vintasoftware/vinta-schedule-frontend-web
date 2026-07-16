import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { HStack } from 'vinta-schedule-design-system/layout';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';

export function BackLink({
  href,
  label = 'Back',
}: {
  href: string;
  label?: string;
}) {
  return (
    <TextLink asChild variant='muted' underline='none' size='md'>
      <Link href={href}>
        <HStack as='span' inline gap={2}>
          <Icon icon={ArrowLeft} size='sm' />
          {label}
        </HStack>
      </Link>
    </TextLink>
  );
}
