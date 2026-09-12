import { getDhakaTodayRange } from './dhaka-date.util';

describe('getDhakaTodayRange', () => {
  it('uses the Bangladesh calendar date around UTC midnight', () => {
    const range = getDhakaTodayRange(new Date('2026-09-11T20:15:00.000Z'));

    expect(range.start.toISOString()).toBe('2026-09-11T18:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-12T17:59:59.999Z');
  });
});
