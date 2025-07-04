/**
 * Late Fine Prevention System
 * 
 * This utility prevents the late fine issue from happening in the future by:
 * 1. Validating late fine rules before saving
 * 2. Auto-fixing existing groups with missing tier rules
 * 3. Providing middleware for group creation/edit operations
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

// Default tier rules to apply when none are defined
const DEFAULT_TIER_RULES = [
    {
        minDays: 1,
        maxDays: 7,
        fineAmount: 5,
        fineType: "PER_DAY"
    },
    {
        minDays: 8,
        maxDays: 15,
        fineAmount: 10,
        fineType: "PER_DAY"
    },
    {
        minDays: 16,
        maxDays: null, // No upper limit
        fineAmount: 15,
        fineType: "PER_DAY"
    }
];

/**
 * Validates late fine rule configuration
 * @param {Object} lateFineRule - The late fine rule to validate
 * @returns {Object} - {isValid: boolean, errors: string[], fixedRule: Object}
 */
function validateLateFineRule(lateFineRule) {
    const errors = [];
    let fixedRule = { ...lateFineRule };

    if (!lateFineRule || typeof lateFineRule !== 'object') {
        return {
            isValid: false,
            errors: ['Late fine rule must be an object'],
            fixedRule: null
        };
    }

    // If late fine is enabled and type is TIER_BASED, tier rules are required
    if (lateFineRule.enabled && lateFineRule.type === 'TIER_BASED') {
        if (!lateFineRule.tierRules || !Array.isArray(lateFineRule.tierRules) || lateFineRule.tierRules.length === 0) {
            errors.push('TIER_BASED late fine rules require at least one tier rule');
            
            // Auto-fix by adding default tier rules
            fixedRule.tierRules = DEFAULT_TIER_RULES;
            console.log('🔧 Auto-fixed: Added default tier rules to TIER_BASED late fine rule');
        } else {
            // Validate existing tier rules
            const tierRuleErrors = validateTierRules(lateFineRule.tierRules);
            errors.push(...tierRuleErrors);
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
 * @param {Array} tierRules - Array of tier rules to validate
 * @returns {Array} - Array of error messages
 */
function validateTierRules(tierRules) {
    const errors = [];

    if (!Array.isArray(tierRules)) {
        return ['Tier rules must be an array'];
    }

    tierRules.forEach((rule, index) => {
        if (!rule.minDays || rule.minDays < 1) {
            errors.push(`Tier rule ${index + 1}: minDays must be at least 1`);
        }

        if (rule.maxDays !== null && rule.maxDays <= rule.minDays) {
            errors.push(`Tier rule ${index + 1}: maxDays must be greater than minDays or null`);
        }

        if (!rule.fineAmount || rule.fineAmount < 0) {
            errors.push(`Tier rule ${index + 1}: fineAmount must be a positive number`);
        }

        if (!rule.fineType || !['PER_DAY', 'FIXED'].includes(rule.fineType)) {
            errors.push(`Tier rule ${index + 1}: fineType must be 'PER_DAY' or 'FIXED'`);
        }
    });

    return errors;
}

/**
 * Validates a group before saving to database
 * @param {Object} group - The group object to validate
 * @returns {Object} - {isValid: boolean, errors: string[], fixedGroup: Object}
 */
function validateGroup(group) {
    const errors = [];
    let fixedGroup = { ...group };

    // Validate late fine rule if present
    if (group.lateFineRule) {
        const lateFineValidation = validateLateFineRule(group.lateFineRule);
        
        if (!lateFineValidation.isValid) {
            errors.push(...lateFineValidation.errors);
        }
        
        // Use the fixed rule even if there were errors (auto-fix)
        if (lateFineValidation.fixedRule) {
            fixedGroup.lateFineRule = lateFineValidation.fixedRule;
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        fixedGroup
    };
}

/**
 * Fixes all existing groups with missing tier rules
 * @returns {Object} - Summary of fixes applied
 */
async function fixAllGroupsWithMissingTierRules() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('shg_management_dev');
        
        console.log('🔍 Checking all groups for late fine rule issues...');
        
        // Find all groups with TIER_BASED late fine rules
        const groups = await db.collection('groups').find({
            lateFineEnabled: true,
            'lateFineRule.type': 'TIER_BASED'
        }).toArray();
        
        console.log(`Found ${groups.length} groups with TIER_BASED late fine rules`);
        
        let fixedCount = 0;
        const fixedGroups = [];
        
        for (const group of groups) {
            const validation = validateLateFineRule(group.lateFineRule);
            
            if (!validation.isValid) {
                // Update the group with fixed rules
                await db.collection('groups').updateOne(
                    { _id: group._id },
                    { 
                        $set: { 
                            lateFineRule: validation.fixedRule,
                            updatedAt: new Date()
                        } 
                    }
                );
                
                fixedCount++;
                fixedGroups.push({
                    id: group._id,
                    name: group.name,
                    errors: validation.errors
                });
                
                console.log(`✅ Fixed group: ${group.name} (${group._id})`);
            }
        }
        
        return {
            totalChecked: groups.length,
            fixedCount,
            fixedGroups,
            success: true
        };
        
    } catch (error) {
        console.error('❌ Error fixing groups:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await client.close();
    }
}

/**
 * Middleware function to validate group before database operations
 * Use this in your API routes for group creation/editing
 */
function validateGroupMiddleware(req, res, next) {
    if (req.body && (req.body.lateFineRule || req.body.lateFineEnabled)) {
        const validation = validateGroup(req.body);
        
        if (!validation.isValid) {
            // Log the auto-fixes applied
            console.log('🔧 Auto-fixes applied to group:', validation.errors);
        }
        
        // Always use the fixed group (auto-fix applied)
        req.body = validation.fixedGroup;
    }
    
    next();
}

/**
 * Calculate late fine amount based on tier rules
 * @param {number} daysOverdue - Number of days overdue
 * @param {Array} tierRules - Array of tier rules
 * @returns {number} - Late fine amount
 */
function calculateLateFine(daysOverdue, tierRules) {
    if (daysOverdue <= 0 || !tierRules || tierRules.length === 0) {
        return 0;
    }
    
    // Find applicable tier
    const applicableTier = tierRules.find(tier => {
        return daysOverdue >= tier.minDays && 
               (tier.maxDays === null || daysOverdue <= tier.maxDays);
    });
    
    if (!applicableTier) {
        return 0;
    }
    
    if (applicableTier.fineType === "PER_DAY") {
        return daysOverdue * applicableTier.fineAmount;
    } else {
        return applicableTier.fineAmount;
    }
}

/**
 * Run a comprehensive check and fix all late fine issues
 */
async function runComprehensiveLateFineCheck() {
    console.log('🚀 Starting Comprehensive Late Fine Check and Fix...\n');
    
    try {
        // Fix all existing groups
        const fixResult = await fixAllGroupsWithMissingTierRules();
        
        console.log('\n📊 Fix Summary:');
        console.log(`- Groups checked: ${fixResult.totalChecked}`);
        console.log(`- Groups fixed: ${fixResult.fixedCount}`);
        
        if (fixResult.fixedGroups.length > 0) {
            console.log('\n🔧 Fixed Groups:');
            fixResult.fixedGroups.forEach(group => {
                console.log(`- ${group.name} (${group.id})`);
                console.log(`  Issues: ${group.errors.join(', ')}`);
            });
        }
        
        console.log('\n✅ Late Fine Prevention System Setup Complete!');
        console.log('\n📝 Next Steps:');
        console.log('1. Add validateGroupMiddleware to your API routes');
        console.log('2. Use validateGroup() before saving groups');
        console.log('3. Use calculateLateFine() for consistent calculations');
        console.log('4. Run this check periodically to catch any issues');
        
        return fixResult;
        
    } catch (error) {
        console.error('❌ Comprehensive check failed:', error);
        return { success: false, error: error.message };
    }
}

// Export functions for use in other files
module.exports = {
    validateLateFineRule,
    validateTierRules,
    validateGroup,
    validateGroupMiddleware,
    calculateLateFine,
    fixAllGroupsWithMissingTierRules,
    runComprehensiveLateFineCheck,
    DEFAULT_TIER_RULES
};

// If this file is run directly, execute the comprehensive check
if (require.main === module) {
    runComprehensiveLateFineCheck().then(result => {
        console.log('\n📋 Final Result:', result);
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}
