/**
 * Late Fine System Prevention and Validation
 * 
 * This file contains functions to prevent and detect late fine configuration issues
 * where TIER_BASED rules are enabled but have no tier rules defined.
 */

/**
 * Validates that a late fine rule is properly configured
 * @param {Object} lateFineRule - The late fine rule object
 * @returns {Object} - Validation result with isValid flag and error message
 */
function validateLateFineRule(lateFineRule) {
  if (!lateFineRule.isEnabled) {
    return { isValid: true, message: 'Rule is disabled' };
  }
  
  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      if (!lateFineRule.dailyAmount || lateFineRule.dailyAmount <= 0) {
        return { 
          isValid: false, 
          message: 'DAILY_FIXED rule requires a positive daily amount' 
        };
      }
      break;
      
    case 'DAILY_PERCENTAGE':
      if (!lateFineRule.dailyPercentage || lateFineRule.dailyPercentage <= 0) {
        return { 
          isValid: false, 
          message: 'DAILY_PERCENTAGE rule requires a positive daily percentage' 
        };
      }
      break;
      
    case 'TIER_BASED':
      if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
        return { 
          isValid: false, 
          message: 'TIER_BASED rule requires at least one tier rule to be defined' 
        };
      }
      
      // Validate tier rules structure
      const tierValidation = validateTierRules(lateFineRule.tierRules);
      if (!tierValidation.isValid) {
        return tierValidation;
      }
      break;
      
    default:
      return { 
        isValid: false, 
        message: `Unknown rule type: ${lateFineRule.ruleType}` 
      };
  }
  
  return { isValid: true, message: 'Rule is properly configured' };
}

/**
 * Validates tier rules for TIER_BASED late fine rules
 * @param {Array} tierRules - Array of tier rule objects
 * @returns {Object} - Validation result
 */
function validateTierRules(tierRules) {
  if (tierRules.length === 0) {
    return { 
      isValid: false, 
      message: 'At least one tier rule is required' 
    };
  }
  
  // Sort tiers by startDay to validate coverage
  const sortedTiers = [...tierRules].sort((a, b) => a.startDay - b.startDay);
  
  // Check if day 1 is covered
  if (sortedTiers[0].startDay > 1) {
    return { 
      isValid: false, 
      message: 'Tier rules must start from day 1' 
    };
  }
  
  // Check for gaps in coverage
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const currentTier = sortedTiers[i];
    const nextTier = sortedTiers[i + 1];
    
    if (currentTier.endDay + 1 < nextTier.startDay) {
      return { 
        isValid: false, 
        message: `Gap in tier coverage between days ${currentTier.endDay} and ${nextTier.startDay}` 
      };
    }
  }
  
  // Validate individual tier rules
  for (const tier of tierRules) {
    if (tier.startDay <= 0) {
      return { 
        isValid: false, 
        message: 'Tier start day must be positive' 
      };
    }
    
    if (tier.endDay && tier.endDay < tier.startDay) {
      return { 
        isValid: false, 
        message: 'Tier end day must be greater than or equal to start day' 
      };
    }
    
    if (!tier.amount || tier.amount <= 0) {
      return { 
        isValid: false, 
        message: 'Tier amount must be positive' 
      };
    }
  }
  
  return { isValid: true, message: 'Tier rules are properly configured' };
}

/**
 * Creates default tier rules for a TIER_BASED late fine rule
 * @returns {Array} - Default tier rules
 */
function createDefaultTierRules() {
  return [
    {
      startDay: 1,
      endDay: 7,
      amount: 5.0, // ₹5 per day for first week
      isPercentage: false
    },
    {
      startDay: 8,
      endDay: 15,
      amount: 10.0, // ₹10 per day for second week
      isPercentage: false
    },
    {
      startDay: 16,
      endDay: 9999, // Large number for unlimited
      amount: 15.0, // ₹15 per day after 15 days
      isPercentage: false
    }
  ];
}

/**
 * Calculates late fine amount based on rule configuration
 * @param {Object} lateFineRule - The late fine rule
 * @param {number} daysLate - Number of days late
 * @param {number} contributionAmount - Expected contribution amount
 * @returns {number} - Calculated late fine amount
 */
function calculateLateFine(lateFineRule, daysLate, contributionAmount) {
  if (!lateFineRule.isEnabled || daysLate <= 0) {
    return 0;
  }
  
  // Apply grace period if defined
  const gracePeriod = lateFineRule.gracePeriodDays || 0;
  const effectiveDaysLate = Math.max(0, daysLate - gracePeriod);
  
  if (effectiveDaysLate <= 0) {
    return 0;
  }
  
  switch (lateFineRule.ruleType) {
    case 'DAILY_FIXED':
      return (lateFineRule.dailyAmount || 0) * effectiveDaysLate;
      
    case 'DAILY_PERCENTAGE':
      const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
      return Math.round((contributionAmount * dailyRate * effectiveDaysLate) * 100) / 100;
      
    case 'TIER_BASED':
      if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
        console.warn('TIER_BASED rule has no tier rules defined');
        return 0;
      }
      
      // Find the applicable tier
      for (const tier of lateFineRule.tierRules) {
        if (effectiveDaysLate >= tier.startDay && effectiveDaysLate <= tier.endDay) {
          if (tier.isPercentage) {
            return Math.round((contributionAmount * tier.amount / 100 * effectiveDaysLate) * 100) / 100;
          } else {
            return tier.amount * effectiveDaysLate;
          }
        }
      }
      
      console.warn(`No tier rule found for ${effectiveDaysLate} days late`);
      return 0;
      
    default:
      console.warn(`Unknown late fine rule type: ${lateFineRule.ruleType}`);
      return 0;
  }
}

/**
 * Calculates due date for a period based on group schedule
 * @param {Object} groupSchedule - Group collection schedule
 * @param {Date} periodStartDate - Start date of the period
 * @returns {Date} - Due date for the period
 */
function calculatePeriodDueDate(groupSchedule, periodStartDate) {
  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  if (frequency === 'MONTHLY') {
    const targetDay = groupSchedule.collectionDayOfMonth || 1;
    const periodMonth = periodStartDate.getMonth();
    const periodYear = periodStartDate.getFullYear();
    
    let dueDate = new Date(periodYear, periodMonth, targetDay);
    
    // Handle months with fewer days than the target day
    if (dueDate.getMonth() !== periodMonth) {
      dueDate = new Date(periodYear, periodMonth + 1, 0); // Last day of the month
    }
    
    return dueDate;
  }
  
  // Add support for other frequencies (WEEKLY, DAILY, etc.) as needed
  return periodStartDate; // Fallback
}

/**
 * Calculates days late based on due date and payment date
 * @param {Date} dueDate - The due date
 * @param {Date} paymentDate - The payment date (or current date if not paid)
 * @returns {number} - Number of days late (0 if not late)
 */
function calculateDaysLate(dueDate, paymentDate) {
  const timeDiff = paymentDate.getTime() - dueDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  return Math.max(0, daysDiff);
}

module.exports = {
  validateLateFineRule,
  validateTierRules,
  createDefaultTierRules,
  calculateLateFine,
  calculatePeriodDueDate,
  calculateDaysLate
};
