import { dateShift, istanbulClock, previousWeek, reminderBand, validateClosedWeek } from "./pilot-periods";
describe('operational calendar',()=>{
  it('uses Istanbul day and Monday09 rather than UTC or server local time',()=>{
    expect(istanbulClock(new Date('2026-10-04T21:00:00Z'))).toEqual({date:'2026-10-05',hour:0,minute:0});
    expect(previousWeek(new Date('2026-10-05T05:59:00Z'))).toEqual({start:'2026-09-28',end:'2026-10-04',due:false});
    expect(previousWeek(new Date('2026-10-05T06:00:00Z')).due).toBe(true);
    expect(previousWeek(new Date('2026-10-07T03:00:00Z')).due).toBe(true);
  });
  it('keeps seven-day intervals across years and rejects partial/current weeks',()=>{
    expect(previousWeek(new Date('2027-01-04T06:00:00Z'))).toMatchObject({start:'2026-12-28',end:'2027-01-03'});
    expect(()=>validateClosedWeek('2026-09-28','2026-10-04','2026-10-05')).not.toThrow();
    expect(()=>validateClosedWeek('2026-09-29','2026-10-05','2026-10-06')).toThrow();
    expect(()=>validateClosedWeek('2026-09-28','2026-10-04','2026-10-04')).toThrow();
    expect(()=>dateShift('2026-02-29',1)).toThrow();expect(dateShift('2028-02-28',1)).toBe('2028-02-29');
  });
  it('classifies short deadlines, last day and overdue independently',()=>{
    expect(reminderBand('2026-10-07','2026-10-01')).toBeNull();
    expect(reminderBand('2026-10-06','2026-10-01')).toBe('five');
    expect(reminderBand('2026-10-03','2026-10-01')).toBe('five');
    expect(reminderBand('2026-10-02','2026-10-01')).toBe('one');
    expect(reminderBand('2026-10-01','2026-10-01')).toBe('one');
    expect(reminderBand('2026-09-30','2026-10-01')).toBe('overdue');
  });
});
