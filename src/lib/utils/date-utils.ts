import { WeekdayEnum } from '@/client';

export function formatDateTime(dateTime: string | null): string | null {
  if (!dateTime) return null;

  const date = new Date(dateTime);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(duration: string | null): string {
  if (!duration || duration === '00:00') return 'No duration';

  const [hours, minutes] = duration.split(':').map(Number);
  return `${hours}h ${minutes}m`;
}

export function formatTime(time: string | null): string {
  if (!time || time === '00:00') return 'No time';

  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatWeekday(weekday: WeekdayEnum): string {
  const weekdays = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  return weekdays[weekday] || 'Unknown';
}
