import { HomeContainer } from '@/components/home-page/home-container';
import { OnboardingGate } from '@/components/authentication/onboarding-gate';

export default async function App() {
  return (
    <OnboardingGate>
      <HomeContainer />
    </OnboardingGate>
  );
}
