/**
 * Helper functions for financial calculations in reports
 */

/**
 * Gets previous period standing to calculate growth
 * 
 * @param currentPeriod The current active period
 * @param oldPeriods Array of all periods
 * @returns Previous period standing or 0 if not found
 */
export const getPreviousPeriodStanding = (
  currentPeriod: { id: string; periodNumber: number } | null,
  oldPeriods: Array<{ 
    id: string; 
    periodNumber: number; 
    isClosed: boolean; 
    totalGroupStandingAtEndOfPeriod: number | null;
  }>
): number => {
  if (!currentPeriod || !oldPeriods.length) return 0;
  
  // Find the most recent closed period before the current one
  const previousPeriod = oldPeriods
    .filter(p => p.isClosed && p.totalGroupStandingAtEndOfPeriod !== null)
    .sort((a, b) => b.periodNumber - a.periodNumber)
    .find(p => p.periodNumber < currentPeriod.periodNumber);
  
  return previousPeriod?.totalGroupStandingAtEndOfPeriod || 0;
};

/**
 * Calculates monthly growth based on current and previous standing
 * 
 * @param currentStanding Current total group standing 
 * @param previousStanding Previous period standing
 * @returns The growth amount and growth percentage
 */
export const calculateMonthlyGrowth = (
  currentStanding: number,
  previousStanding: number
): { amount: number; percentage: number } => {
  const growthAmount = currentStanding - previousStanding;
  const growthPercentage = previousStanding > 0 
    ? (growthAmount / previousStanding) * 100
    : 0;
    
  return {
    amount: growthAmount,
    percentage: growthPercentage
  };
};
