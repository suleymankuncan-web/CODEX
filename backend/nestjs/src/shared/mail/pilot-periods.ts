const dayMs = 86_400_000;
export function istanbulClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Istanbul", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23" }).formatToParts(now);
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  return {date:`${part("year")}-${part("month")}-${part("day")}`,hour:Number(part("hour")),minute:Number(part("minute"))};
}
export function dateShift(date:string, days:number) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0,10)!==date) throw new Error("invalid_mail_date");
  return new Date(Date.parse(`${date}T00:00:00Z`)+days*dayMs).toISOString().slice(0,10);
}
export function previousWeek(now = new Date()) {
  const clock=istanbulClock(now);
  const weekday=new Date(`${clock.date}T12:00:00Z`).getUTCDay() || 7;
  const monday=dateShift(clock.date,1-weekday);
  return {start:dateShift(monday,-7),end:dateShift(monday,-1),due:clock.date>monday || clock.hour>=9};
}
export function validateClosedWeek(start:string,end:string,today=istanbulClock().date) {
  dateShift(start,0); dateShift(end,0);
  if(new Date(start).getUTCDay()!==1 || dateShift(start,6)!==end || end>=today) throw new Error("mail_week_must_be_closed_monday_sunday");
}
export function reminderBand(dueOn:string,today:string):"five"|"one"|"overdue"|null {
  const days=(Date.parse(dateShift(dueOn,0))-Date.parse(dateShift(today,0)))/dayMs;
  return days<=-1 ? "overdue" : days<=1 && days>=0 ? "one" : days<=5 ? "five" : null;
}
export function trMonth(period:string) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("invalid_mail_period");
  return new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${period}-01T12:00:00Z`));
}
