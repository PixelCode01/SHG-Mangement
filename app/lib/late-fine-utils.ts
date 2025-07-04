/**
 * Utility functions for calculating late fines based on group rules and due dates
 */

import { calculateLateFineInfo } from './due-date-utils';

export interface LateFineRule {
  id: string;
  isEnabled: boolean;
  ruleType: 'DAILY_FIXED' | 'DAILY_PERCENTAGE' | 'TIER_BASED';
  dailyAmount?: number | null;
  dailyPercentage?: number | null;
  tierRules?: LateFineRuleTier[];
}

export interface LateFineRuleTier {
  id: string;
  startDay: number;
  endDay: number;
  amount: number;
  isPercentage: boolean;
}

/**
 * Calculate late fine amount based on group's late fine rules
 * @param lateFineRule - The group's late fine rule configuration
 * @param daysLate - Number of days the payment is late
 * @param expectedContribution - The expected contribution amount
 * @returns The calculated late fine amount
 */
export function calculateLateFineAmount(
  lateFineRule: LateFineRule | null | undefined,
  daysLate: number,
  expectedContribution: number
): number {
  // No fine if no rule, rule disabled, or not late
  if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
    return 0;
  }

  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      return (lateFineRule.dailyAmount || 0) * daysLate;
      
    case 'DAILY_PERCENTAGE':
      const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
      return Math.round((expectedContribution * dailyRate * daysLate) * 100) / 100; // Round to 2 decimal places
      
    case 'TIER_BASED':
      if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
        return 0;
      }
      
      // Calculate cumulative fine for all days (tier-based is per day, not total)
      let totalFine = 0;
      
      for (let day = 1; day <= daysLate; day++) {
        // Find the applicable tier for this specific day
        let applicableTier: LateFineRuleTier | null = null;
        for (const tier of lateFineRule.tierRules) {
          if (day >= tier.startDay && day <= tier.endDay) {
            applicableTier = tier;
            break;
          }
        }
        
        if (applicableTier) {
          // Add the daily fine for this day based on its tier
          if (applicableTier.isPercentage) {
            const tierRate = applicableTier.amount / 100;
            totalFine += expectedContribution * tierRate; // Daily percentage fine
          } else {
            totalFine += applicableTier.amount; // Daily fixed fine
          }
        }
      }
      
      // Round to 2 decimal places
      return Math.round(totalFine * 100) / 100;
      
    default:
      return 0;
  }
}

/**
 * Calculate both days late and late fine amount for a member's contribution
 * @param periodStartDate - When the period started
 * @param groupSchedule - Group's collection schedule
 * @param lateFineRule - Group's late fine rule
 * @param expectedContribution - Expected contribution amount
 * @param paymentDate - When payment was made (defaults to now)
 * @returns Object with calculated late fine information
 */
export function calculateMemberLateFine(
  periodStartDate: Date,
  groupSchedule: {
    collectionFrequency: string;
    collectionDayOfMonth?: number | null;
    collectionDayOfWeek?: string | null;
    collectionWeekOfMonth?: number | null;
  },
  lateFineRule: LateFineRule | null | undefined,
  expectedContribution: number,
  paymentDate: Date = new Date()
): {
  daysLate: number;
  lateFineAmount: number;
  dueDate: Date;
  isLate: boolean;
} {
  // Import due date calculation functions
  const lateFineInfo = calculateLateFineInfo(groupSchedule, periodStartDate, paymentDate);
  const lateFineAmount = calculateLateFineAmount(lateFineRule, lateFineInfo.daysLate, expectedContribution);
  
  return {
    daysLate: lateFineInfo.daysLate,
    lateFineAmount,
    dueDate: lateFineInfo.dueDate,
    isLate: lateFineInfo.isLate
  };
}

/**
 * Validate and recalculate late fine information for period closing
 * This ensures backend validation of late fines based on actual group rules
 */
export function validateAndRecalculateLateFines(
  memberContributions: Array<{
    memberId: string;
    expectedContribution: number;
    lateFineAmount: number;
    daysLate: number;
  }>,
  periodStartDate: Date,
  groupSchedule: {
    collectionFrequency: string;
    collectionDayOfMonth?: number | null;
    collectionDayOfWeek?: string | null;
    collectionWeekOfMonth?: number | null;
  },
  lateFineRule: LateFineRule | null | undefined,
  paymentDate: Date = new Date()
): Array<{
  memberId: string;
  expectedContribution: number;
  lateFineAmount: number;
  daysLate: number;
  originalLateFineAmount: number;
  recalculated: boolean;
}> {
  return memberContributions.map(memberContrib => {
    const recalculated = calculateMemberLateFine(
      periodStartDate,
      groupSchedule,
      lateFineRule,
      memberContrib.expectedContribution,
      paymentDate
    );
    
    const wasRecalculated = 
      Math.abs(recalculated.lateFineAmount - memberContrib.lateFineAmount) > 0.01 ||
      recalculated.daysLate !== memberContrib.daysLate;
    
    return {
      memberId: memberContrib.memberId,
      expectedContribution: memberContrib.expectedContribution,
      lateFineAmount: recalculated.lateFineAmount,
      daysLate: recalculated.daysLate,
      originalLateFineAmount: memberContrib.lateFineAmount,
      recalculated: wasRecalculated
    };
  });
}
