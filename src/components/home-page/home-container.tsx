import { Navigation } from '../navigation/navigation';

export function HomeContainer() {
  return (
    <div className='bg-background min-h-screen'>
      <Navigation />
      <main>
        <h1 className='p-8 text-center text-4xl font-bold'>
          Welcome to Vinta Schedule
        </h1>
      </main>
    </div>
  );
}
