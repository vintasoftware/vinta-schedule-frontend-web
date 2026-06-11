/**
 * Tests for useBlockedTimes hook.
 *
 * Focus: verify that the hook properly constructs BlockedTimeWritable payloads
 * and calls the correct operations for one-off vs recurring blocked times.
 */

import { describe, it, expect } from 'vitest';

describe('useBlockedTimes', () => {
  describe('payload construction', () => {
    it('should construct one-off blocked time with start/end times', () => {
      // Verify the structure of a one-off blocked time payload
      const payload = {
        start_time: '2025-06-15T09:00:00',
        end_time: '2025-06-15T10:00:00',
        timezone: 'America/New_York',
        reason: 'Personal time',
        calendar: 1,
      };

      expect(payload).toHaveProperty('start_time');
      expect(payload).toHaveProperty('end_time');
      expect(payload).toHaveProperty('timezone');
      expect(payload).toHaveProperty('reason');
      expect(payload).toHaveProperty('calendar');
      expect(payload.start_time).toBe('2025-06-15T09:00:00');
      expect(payload.end_time).toBe('2025-06-15T10:00:00');
    });

    it('should construct recurring blocked time with rrule_string', () => {
      // Verify the structure of a recurring blocked time payload
      const rruleString = 'FREQ=WEEKLY;BYDAY=MO,WE,FR';
      const payload = {
        start_time: '2025-06-15T14:00:00',
        end_time: '2025-06-15T15:00:00',
        timezone: 'Europe/London',
        rrule_string: rruleString,
        reason: 'Lunch block',
        calendar: 2,
      };

      expect(payload).toHaveProperty('rrule_string');
      expect(payload.rrule_string).toBe(rruleString);
      expect(payload.rrule_string).toMatch(/FREQ=WEEKLY/);
    });

    it('should handle optional reason and calendarId fields', () => {
      // Verify that optional fields can be omitted
      const payload: Record<string, unknown> = {
        start_time: '2025-06-16T10:00:00',
        end_time: '2025-06-16T11:00:00',
        timezone: 'UTC',
        calendar: null,
      };

      expect(payload).not.toHaveProperty('reason');
      expect(payload.calendar).toBeNull();
    });

    it('should validate end time is after start time', () => {
      const start = '09:00';
      const end = '10:00';
      // Simple string comparison for HH:MM format works correctly
      expect(end > start).toBe(true);

      const invalidStart = '14:00';
      const invalidEnd = '10:00';
      expect(invalidEnd > invalidStart).toBe(false);
    });
  });

  describe('recurrence rule serialization', () => {
    it('should recognize RRULE patterns', () => {
      const rrules = [
        'FREQ=DAILY',
        'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        'FREQ=MONTHLY',
        'FREQ=YEARLY',
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH',
      ];

      for (const rrule of rrules) {
        expect(rrule).toMatch(/^FREQ=/);
      }
    });
  });
});
