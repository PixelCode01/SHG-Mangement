/**
 * JavaScript version of late fine validation for Node.js testing
 * 
 * This provides the same validation logic as the TypeScript version
 * but can be imported and tested in Node.js scripts.
 */

// Default tier rules compatible with API schema
const DEFAULT_TIER_RULES = [
    {
        startDay: 1,
        endDay: 7,
        amount: 5,
        isPercentage: false
    },
    {
        startDay: 8,
        endDay: 15,
        amount: 10,
        isPercentage: false
    },
    {
        startDay: 16,
        endDay: 9999, // Large number to represent "no upper limit"
        amount: 15,
        isPercentage: false
    }
];

/**
 * Validates and fixes late fine rule
 */
function validateAndFixLateFineRule(lateFineRule) {
    if (!lateFineRule) {
        return { 
            isValid: true, 
            errors: [], 
            fixedRule: undefined
        };
    }

    const errors = [];
    let fixedRule = { ...lateFineRule };

    // Check if late fine is enabled and uses tier-based rules
    if (lateFineRule.isEnabled && lateFineRule.ruleType === 'TIER_BASED') {
        // Check if tier rules exist and are valid
        if (!lateFineRule.tierRules || !Array.isArray(lateFineRule.tierRules) || lateFineRule.tierRules.length === 0) {
            errors.push('TIER_BASED late fine rules require at least one tier rule');
            
            // Auto-fix by adding default tier rules
            fixedRule.tierRules = DEFAULT_TIER_RULES;
            console.log('🔧 Auto-fixed: Added default tier rules to TIER_BASED late fine rule');
        } else {
            // Validate existing tier rules
            const tierValidation = validateTierRules(lateFineRule.tierRules);
            if (!tierValidation.isValid) {
                errors.push(...tierValidation.errors);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        fixedRule
    };
}

/**
 * Validates tier rules array
 */
function validateTierRules(tierRules) {
    const errors = [];

    if (!Array.isArray(tierRules)) {
        return {
            isValid: false,
            errors: ['Tier rules must be an array']
        };
    }

    tierRules.forEach((rule, index) => {
        if (!rule.startDay || rule.startDay < 1) {
            errors.push(`Tier rule ${index + 1}: startDay must be at least 1`);
        }

        if (!rule.endDay || rule.endDay < rule.startDay) {
            errors.push(`Tier rule ${index + 1}: endDay must be greater than or equal to startDay`);
        }

        if (rule.amount === undefined || rule.amount < 0) {
            errors.push(`Tier rule ${index + 1}: amount must be a non-negative number`);
        }

        if (typeof rule.isPercentage !== 'boolean') {
            errors.push(`Tier rule ${index + 1}: isPercentage must be a boolean`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates group data including late fine rules
 */
function validateGroupForAPI(groupData) {
    const errors = [];
    let fixedData = { ...groupData };

    // Validate late fine rule if present
    if (groupData.lateFineRule) {
        const lateFineValidation = validateAndFixLateFineRule(groupData.lateFineRule);
        
        if (!lateFineValidation.isValid) {
            // Log warnings for auto-fixes
            console.warn('⚠️ Late fine rule auto-fixes applied:', lateFineValidation.errors);
        }
        
        // Always use the fixed rule (auto-fix applied)
        fixedData.lateFineRule = lateFineValidation.fixedRule;
    }

    return {
        isValid: errors.length === 0,
        errors,
        fixedData
    };
}

/**
 * Calculate late fine amount using API schema tier rules
 */
function calculateLateFineFromAPIRules(daysOverdue, tierRules) {
    if (daysOverdue <= 0 || !tierRules || tierRules.length === 0) {
        return 0;
    }
    
    // Find applicable tier (API schema uses startDay/endDay)
    const applicableTier = tierRules.find(tier => {
        return daysOverdue >= tier.startDay && daysOverdue <= tier.endDay;
    });
    
    if (!applicableTier) {
        return 0;
    }
    
    if (applicableTier.isPercentage) {
        // Return percentage amount (would need base amount to calculate)
        return applicableTier.amount;
    } else {
        // Per day amount
        return daysOverdue * applicableTier.amount;
    }
}

module.exports = {
    validateAndFixLateFineRule,
    validateTierRules,
    validateGroupForAPI,
    calculateLateFineFromAPIRules,
    DEFAULT_TIER_RULES
};
