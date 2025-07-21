/**
 * Utility functions for monetary calculations in SHG Management System
 */

/**
 * Round a monetary value to 2 decimal places
 * @param amount - The amount to round
 * @returns The amount rounded to 2 decimal places
 */
export function roundToTwoDecimals(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Format a number as currency with proper rounding
 * @param amount - The amount to format
 * @returns Formatted currency string with rupee symbol
 */
export function formatCurrency(amount: number): string {
  return 'Rs. ' + roundToTwoDecimals(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Parse a currency input string to a number with proper validation
 * @param input - The input string
 * @returns Parsed number rounded to 2 decimal places
 */
export function parseCurrencyInput(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : roundToTwoDecimals(parsed);
}
