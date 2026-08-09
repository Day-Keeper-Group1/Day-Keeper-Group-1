/**
 * The reminder scheduling rule.
 *
 * The numbers asserted here are the product's promise as the prototype makes
 * it: a bill due Saturday 15 August promises reminders on Saturday the 8th and
 * Friday the 14th at 9 am, and an appointment promises exactly one, the day
 * before. If someone changes the rule deliberately, these tests are where the
 * old promise is looked in the eye first.
 */

import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_REMINDER_OFFSET_DAYS,
  DEADLINE_REMINDER_OFFSET_DAYS,
  REMINDER_HOUR_LOCAL,
  planReminders,
} from '@/lib/contract/reminders';

describe('a deadline', () => {
  const plan = planReminders('2026-08-15', { hasTime: false });

  it('gets two reminders, seven days and one day before', () => {
    expect(DEADLINE_REMINDER_OFFSET_DAYS).toEqual([7, 1]);
    expect(plan.map((p) => p.offsetDays)).toEqual([7, 1]);
    expect(plan.map((p) => p.localDate)).toEqual(['2026-08-08', '2026-08-14']);
  });

  it("lands at 9 am on the person's clock", () => {
    expect(REMINDER_HOUR_LOCAL).toBe(9);
    expect(plan.every((p) => p.localTime === '09:00')).toBe(true);
    // 9 am AEST is 23:00 UTC the previous evening.
    expect(plan[0].scheduledFor.toISOString()).toBe('2026-08-07T23:00:00.000Z');
    expect(plan[1].scheduledFor.toISOString()).toBe('2026-08-13T23:00:00.000Z');
  });
});

describe('an appointment', () => {
  const plan = planReminders('2026-09-04', { hasTime: true });

  it('gets one reminder, the day before', () => {
    expect(APPOINTMENT_REMINDER_OFFSET_DAYS).toEqual([1]);
    expect(plan).toHaveLength(1);
    expect(plan[0].localDate).toBe('2026-09-03');
    expect(plan[0].localTime).toBe('09:00');
  });
});

describe('the function itself', () => {
  it('is pure: same input, same plan', () => {
    const a = planReminders('2026-08-15', { hasTime: false });
    const b = planReminders('2026-08-15', { hasTime: false });
    expect(a).toEqual(b);
  });

  it('refuses a date that is not a date', () => {
    expect(() => planReminders('15 Aug 2026', { hasTime: false })).toThrow(
      TypeError,
    );
  });
});
