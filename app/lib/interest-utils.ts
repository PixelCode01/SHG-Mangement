/**
 * Utility functions for interest calculations in SHG Management System
 */

import { CollectionFrequency } from '@prisma/client';
import { roundToTwoDecimals } from './currency-utils';

/**
 * Calculate interest for a specific period based on annual interest rate and collection frequency
 * @param loanAmount - The loan amount/balance
 * @param annualInterestRate - Annual interest rate as a percentage (e.g., 12 for 12%)
 * @param frequency - Collection frequency (WEEKLY, FORTNIGHTLY, MONTHLY, YEARLY)
 * @returns Interest amount for the period
 */
export function calculatePeriodInterest(
  loanAmount: number,
  annualInterestRate: number,
  frequency: CollectionFrequency
): number {
  if (!loanAmount || !annualInterestRate) return 0;
  
  // Convert annual rate to period rate based on collection frequency
  let periodRate = 0;
  switch (frequency) {
    case 'WEEKLY':
      periodRate = annualInterestRate / 52; // 52 weeks per year
      break;
    case 'FORTNIGHTLY':
      periodRate = annualInterestRate / 26; // 26 fortnights per year
      break;
    case 'MONTHLY':
      periodRate = annualInterestRate / 12; // 12 months per year
      break;
    case 'YEARLY':
      periodRate = annualInterestRate; // Already annual
      break;
    default:
      periodRate = annualInterestRate / 12; // Default to monthly
  }
  
  return roundToTwoDecimals((loanAmount * periodRate) / 100);
}

/**
 * Calculate interest for a specific period - legacy version that takes rate as decimal
 * @param loanAmount - The loan amount/balance
 * @param annualInterestRateDecimal - Annual interest rate as decimal (e.g., 0.12 for 12%)
 * @param frequency - Collection frequency
 * @returns Interest amount for the period
 */
export function calculatePeriodInterestFromDecimal(
  loanAmount: number,
  annualInterestRateDecimal: number,
  frequency: CollectionFrequency
): number {
  return calculatePeriodInterest(loanAmount, annualInterestRateDecimal * 100, frequency);
}

/**
 * Get the number of periods per year for a given collection frequency
 * @param frequency - Collection frequency
 * @returns Number of periods per year
 */
export function getPeriodsPerYear(frequency: CollectionFrequency): number {
  switch (frequency) {
    case 'WEEKLY': return 52;
    case 'FORTNIGHTLY': return 26;
    case 'MONTHLY': return 12;
    case 'YEARLY': return 1;
    default: return 12; // Default to monthly
  }
}
