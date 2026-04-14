import { addDays, differenceInDays, format, isWeekend, startOfWeek } from 'date-fns';
import { Batch, Seat } from './types';

// Reference date: Monday, April 13, 2026 (Start of a Week 1)
export const REFERENCE_DATE = new Date(2026, 3, 13); 

export function getWeekType(date: Date): 1 | 2 {
  const startOfRefWeek = startOfWeek(REFERENCE_DATE, { weekStartsOn: 1 });
  const startOfTargetWeek = startOfWeek(date, { weekStartsOn: 1 });
  const diffWeeks = Math.floor(differenceInDays(startOfTargetWeek, startOfRefWeek) / 7);
  return (Math.abs(diffWeeks) % 2 === 0) ? 1 : 2;
}

export function isWorkingDayForBatch(date: Date, batch: Batch): boolean {
  if (isWeekend(date)) return false;
  
  const weekType = getWeekType(date);
  const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
  
  // Week 1: B1 (M-W: 1,2,3), B2 (Th-F: 4,5)
  // Week 2: B1 (Th-F: 4,5), B2 (M-W: 1,2,3)
  
  if (weekType === 1) {
    if (batch === 1) return dayOfWeek >= 1 && dayOfWeek <= 3;
    if (batch === 2) return dayOfWeek >= 4 && dayOfWeek <= 5;
  } else {
    if (batch === 1) return dayOfWeek >= 4 && dayOfWeek <= 5;
    if (batch === 2) return dayOfWeek >= 1 && dayOfWeek <= 3;
  }
  
  return false;
}

// 50 Seats: 40 Fixed, 10 Floater
export const SEATS: Seat[] = Array.from({ length: 50 }, (_, i) => ({
  id: `seat-${i + 1}`,
  label: `${i + 1}`,
  type: i < 40 ? 'fixed' : 'floater',
  x: (i % 10) * 60 + 20,
  y: Math.floor(i / 10) * 60 + 20,
}));
