/**
 * Utility functions for calculating due dates based on group collection schedules
 * Used for late fine calculations and period management
 */

export interface GroupCollectionSchedule {
  collectionFrequency: string; // Allow Prisma enum types
  collectionDayOfMonth?: number | null; // For monthly/yearly (1-31)
  collectionDayOfWeek?: string | null; // For weekly/fortnightly
  collectionWeekOfMonth?: number | null; // For fortnightly (1-4)
}

// Helper function to convert day name to number (0 = Sunday, 1 = Monday, etc.)
const getDayOfWeekNumber = (dayName: string): number => {
  const days = {
    'SUNDAY': 0,
    'MONDAY': 1,
    'TUESDAY': 2,
    'WEDNESDAY': 3,
    'THURSDAY': 4,
    'FRIDAY': 5,
    'SATURDAY': 6
  };
  return days[dayName as keyof typeof days] || 1;
};

/**
 * Calculate the due date for a specific period based on group collection schedule
 * @param groupSchedule - Group's collection schedule configuration
 * @param periodDate - The reference date for the period (usually period start date)
 * @returns The due date for that period
 */
export function calculatePeriodDueDate(
  groupSchedule: GroupCollectionSchedule, 
  periodDate: Date
): Date {
  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  switch (frequency) {
    case 'WEEKLY': {
      const targetDay = getDayOfWeekNumber(groupSchedule.collectionDayOfWeek || 'MONDAY');
      const periodStartUTC = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), periodDate.getUTCDate()));
      const periodStartDay = periodStartUTC.getUTCDay();
      
      // Calculate which day in the week the period started
      // Find the target day within that week
      const daysFromStart = (targetDay - periodStartDay + 7) % 7;
      const dueDate = new Date(periodStartUTC);
      dueDate.setUTCDate(periodStartUTC.getUTCDate() + daysFromStart);
      
      return dueDate;
    }
    
    case 'FORTNIGHTLY': {
      const targetDay = getDayOfWeekNumber(groupSchedule.collectionDayOfWeek || 'MONDAY');
      const weekOfMonth = groupSchedule.collectionWeekOfMonth || 1;
      
      // For fortnightly, we need to find the specific week occurrence
      const periodMonth = periodDate.getUTCMonth();
      const periodYear = periodDate.getUTCFullYear();
      
      // Find the first occurrence of target day in the month
      const firstOfMonth = new Date(Date.UTC(periodYear, periodMonth, 1));
      const firstTargetDay = new Date(firstOfMonth);
      firstTargetDay.setUTCDate(1 + ((targetDay - firstOfMonth.getUTCDay() + 7) % 7));
      
      // Calculate the target date based on week of month
      const targetDate = new Date(firstTargetDay);
      if (weekOfMonth === 2 || weekOfMonth === 4) {
        targetDate.setUTCDate(firstTargetDay.getUTCDate() + 7);
      }
      if (weekOfMonth === 3 || weekOfMonth === 4) {
        targetDate.setUTCDate(targetDate.getUTCDate() + 7);
      }
      
      return targetDate;
    }
    
    case 'MONTHLY': {
      const targetDay = groupSchedule.collectionDayOfMonth || 1;
      
      // For monthly collections, the due date is the collection day of the period's month
      // The period represents the month for which contributions are due
      const periodMonth = periodDate.getUTCMonth();
      const periodYear = periodDate.getUTCFullYear();
      
      // Create due date on the target day of the period's month using UTC
      let dueDate = new Date(Date.UTC(periodYear, periodMonth, targetDay, 0, 0, 0, 0));
      
      // Handle months with fewer days (e.g., February 30 → February 28/29)
      if (dueDate.getUTCMonth() !== periodMonth) {
        // If the target day doesn't exist in this month, use the last day of the month
        dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, 0, 0, 0, 0, 0)); // Last day of the month
      }
      
      return dueDate;
    }
    
    case 'YEARLY': {
      const targetDay = groupSchedule.collectionDayOfMonth || 1;
      const targetMonth = 0; // January by default, could be extended
      const periodYear = periodDate.getUTCFullYear();
      
      const dueDate = new Date(Date.UTC(periodYear, targetMonth, targetDay, 0, 0, 0, 0));
      
      return dueDate;
    }
    
    default:
      const defaultDate = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), periodDate.getUTCDate(), 0, 0, 0, 0));
      return defaultDate;
  }
}

/**
 * Calculate how many days late a payment is based on due date
 * @param dueDate - The due date for the period
 * @param paymentDate - The date payment was made (defaults to now)
 * @returns Number of days late (0 if not late)
 */
export function calculateDaysLate(dueDate: Date, paymentDate: Date = new Date()): number {
  // Convert both dates to UTC date-only for consistent comparison
  const dueDateUTC = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const paymentDateUTC = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), paymentDate.getUTCDate()));
  
  const timeDiff = paymentDateUTC.getTime() - dueDateUTC.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // Only consider it late if payment is after the due date
  return Math.max(0, daysDiff);
}

/**
 * Determine if a payment should incur late fines based on due date
 * @param groupSchedule - Group's collection schedule configuration
 * @param periodStartDate - When the period started
 * @param paymentDate - When payment was made (defaults to now)
 * @returns Object with late fine information
 */
export function calculateLateFineInfo(
  groupSchedule: GroupCollectionSchedule,
  periodStartDate: Date,
  paymentDate: Date = new Date()
): {
  dueDate: Date;
  daysLate: number;
  isLate: boolean;
} {
  const dueDate = calculatePeriodDueDate(groupSchedule, periodStartDate);
  const daysLate = calculateDaysLate(dueDate, paymentDate);
  
  return {
    dueDate,
    daysLate,
    isLate: daysLate > 0
  };
}

/**
 * Get the current period's due date (most recent due date that has passed or is current)
 * This is useful for calculating late fines on current contributions
 */
export function getCurrentPeriodDueDate(groupSchedule: GroupCollectionSchedule): Date {
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  switch (frequency) {
    case 'WEEKLY': {
      const targetDay = getDayOfWeekNumber(groupSchedule.collectionDayOfWeek || 'MONDAY');
      const currentDay = todayUTC.getUTCDay();
      // Find the most recent target day (could be today or in the past)
      const daysFromTarget = (currentDay - targetDay + 7) % 7;
      const dueDate = new Date(todayUTC);
      dueDate.setUTCDate(todayUTC.getUTCDate() - daysFromTarget);
      return dueDate;
    }
    
    case 'MONTHLY': {
      const targetDay = groupSchedule.collectionDayOfMonth || 1;
      const currentMonth = todayUTC.getUTCMonth();
      const currentYear = todayUTC.getUTCFullYear();
      let dueDate = new Date(Date.UTC(currentYear, currentMonth, targetDay));
      
      // Handle months with fewer days
      if (dueDate.getUTCMonth() !== currentMonth) {
        dueDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0)); // Last day of current month
      }
      
      // If the target day hasn't passed this month, it's the current due date
      if (dueDate <= todayUTC) {
        return dueDate;
      }
      
      // Otherwise, use the previous month's due date
      let prevDueDate = new Date(Date.UTC(currentYear, currentMonth - 1, targetDay));
      
      // Handle months with fewer days for previous month
      if (prevDueDate.getUTCMonth() !== (currentMonth - 1 + 12) % 12) {
        prevDueDate = new Date(Date.UTC(currentYear, currentMonth, 0)); // Last day of previous month
      }
      
      return prevDueDate;
    }
    
    case 'YEARLY': {
      const targetDay = groupSchedule.collectionDayOfMonth || 1;
      const targetMonth = 0; // January by default
      const currentYear = todayUTC.getUTCFullYear();
      let dueDate = new Date(Date.UTC(currentYear, targetMonth, targetDay));
      
      // If the target date hasn't passed this year, use last year's date
      if (dueDate > todayUTC) {
        dueDate = new Date(Date.UTC(currentYear - 1, targetMonth, targetDay));
      }
      
      return dueDate;
    }
    
    // For fortnightly, it's more complex - using monthly logic as fallback
    case 'FORTNIGHTLY':
    default:
      return todayUTC;
  }
}
