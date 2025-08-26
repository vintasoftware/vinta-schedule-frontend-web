import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGoogle,
  faFacebook,
  faApple,
} from '@fortawesome/free-brands-svg-icons';
import { User } from 'lucide-react';
import type { Provider } from '@/auth-client';

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
