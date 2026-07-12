import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGoogle,
  faFacebook,
  faApple,
} from '@fortawesome/free-brands-svg-icons';
import { User } from 'lucide-react';
import type { Provider } from '@/auth-client';

/**
 * Brand glyph for a social provider.
 *
 * `FontAwesomeIcon` is a third-party component: it takes neither the DS box
 * props nor `Icon`'s `LucideIcon` contract, so its trailing margin can only be
 * expressed as a class (the allowed third-party escape hatch). The `<User />`
 * fallback is a bare lucide glyph inside a `<Button>`, which already sizes its
 * svg children — it needs nothing.
 */
export function SocialProviderIcon({ provider }: { provider: Provider }) {
  switch (provider.id) {
    case 'google':
      return <FontAwesomeIcon icon={faGoogle} className='mr-2' />;
    case 'facebook':
      return <FontAwesomeIcon icon={faFacebook} className='mr-2' />;
    case 'apple':
      return <FontAwesomeIcon icon={faApple} className='mr-2' />;
    default:
      return <User />;
  }
}
