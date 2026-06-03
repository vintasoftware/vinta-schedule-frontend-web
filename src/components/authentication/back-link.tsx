import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({
  href,
  label = 'Back',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className='text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm transition-colors'
    >
      <ArrowLeft className='h-4 w-4' />
      {label}
    </Link>
  );
}
