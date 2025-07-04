/**
 * Post-Cleanup Late Fine Analysis
 * 
 * Analyzes current database state after cleanup and validates our prevention system
 * for both existing groups and future group creation scenarios.
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function analyzePostCleanupState() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('🔍 Post-Cleanup Late Fine Analysis');
        console.log('===================================\n');
        
        // Check both possible database names
        const databases = ['shg_management', 'shg_management_dev'];
        
        for (const dbName of databases) {
            console.log(`📊 Checking database: ${dbName}`);
            const db = client.db(dbName);
            
            // 1. Check total groups
            const totalGroups = await db.collection('groups').countDocuments();
            console.log(`   Total groups: ${totalGroups}`);
            
            if (totalGroups === 0) {
                console.log('   ❌ No groups found in this database\n');
                continue;
            }
            
            // 2. Check groups with late fines enabled
            const groupsWithLateFines = await db.collection('groups').find({
                $or: [
                    { lateFineEnabled: true },
                    { 'lateFineRule.isEnabled': true },
                    { 'lateFineRule.enabled': true }
                ]
            }).toArray();
            
            console.log(`   Groups with late fines enabled: ${groupsWithLateFines.length}`);
            
            // 3. Check for TIER_BASED rules
            const tierBasedGroups = await db.collection('groups').find({
                $or: [
                    { 'lateFineRule.type': 'TIER_BASED' },
                    { 'lateFineRule.ruleType': 'TIER_BASED' }
                ]
            }).toArray();
            
            console.log(`   Groups with TIER_BASED rules: ${tierBasedGroups.length}`);
            
            // 4. Check for problematic groups (TIER_BASED without tier rules)
            let problematicGroups = [];
            
            for (const group of tierBasedGroups) {
                const lateFineRule = group.lateFineRule;
                let hasValidTierRules = false;
                
                // Check both possible tier rule field names
                if (lateFineRule.tierRules && Array.isArray(lateFineRule.tierRules) && lateFineRule.tierRules.length > 0) {
                    hasValidTierRules = true;
                } else if (lateFineRule.tiers && Array.isArray(lateFineRule.tiers) && lateFineRule.tiers.length > 0) {
                    hasValidTierRules = true;
                }
                
                if (!hasValidTierRules) {
                    problematicGroups.push({
                        id: group._id,
                        name: group.name,
                        lateFineRule: lateFineRule
                    });
                }
            }
            
            console.log(`   ❌ Problematic groups (TIER_BASED without tier rules): ${problematicGroups.length}`);
            
            if (problematicGroups.length > 0) {
                console.log('\n   🚨 FOUND PROBLEMATIC GROUPS:');
                problematicGroups.forEach((group, index) => {
                    console.log(`   ${index + 1}. ${group.name} (${group.id})`);
                    console.log(`      Late fine rule:`, JSON.stringify(group.lateFineRule, null, 6));
                });
            }
            
            // 5. Sample a few groups to check their structure
            if (totalGroups > 0) {
                console.log('\n   📋 Sample group structures:');
                const sampleGroups = await db.collection('groups').find().limit(3).toArray();
                
                sampleGroups.forEach((group, index) => {
                    console.log(`   Group ${index + 1}: ${group.name || 'Unnamed'} (${group._id})`);
                    console.log(`      Late fine enabled: ${group.lateFineEnabled || group.lateFineRule?.isEnabled || group.lateFineRule?.enabled || 'false'}`);
                    if (group.lateFineRule) {
                        console.log(`      Late fine rule type: ${group.lateFineRule.type || group.lateFineRule.ruleType || 'undefined'}`);
                        const tierCount = (group.lateFineRule.tierRules?.length || 0) + (group.lateFineRule.tiers?.length || 0);
                        console.log(`      Tier rules count: ${tierCount}`);
                    }
                });
            }
            
            console.log('\n');
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Error during analysis:', error);
        return { success: false, error: error.message };
    } finally {
        await client.close();
    }
}

/**
 * Test our prevention system by simulating group creation scenarios
 */
async function testPreventionSystem() {
    console.log('🧪 Testing Prevention System');
    console.log('============================\n');
    
    // Test case 1: Group with problematic late fine rule
    const problematicGroup = {
        name: "Test Group - Problematic",
        lateFineRule: {
            isEnabled: true,
            ruleType: "TIER_BASED",
            tierRules: [] // This should trigger our auto-fix
        }
    };
    
    console.log('Test 1: Problematic late fine rule (empty tierRules)');
    console.log('Input:', JSON.stringify(problematicGroup.lateFineRule, null, 2));
    
    // Simulate our validation function
    try {
        const { validateGroupForAPI } = require('./app/lib/late-fine-validation.ts');
        const result = validateGroupForAPI(problematicGroup);
        
        console.log('Validation result:');
        console.log('- Is valid:', result.isValid);
        console.log('- Errors:', result.errors);
        console.log('- Fixed rule:', JSON.stringify(result.fixedData?.lateFineRule, null, 2));
        
        if (result.fixedData?.lateFineRule?.tierRules?.length > 0) {
            console.log('✅ Auto-fix applied successfully');
        } else {
            console.log('❌ Auto-fix failed');
        }
    } catch (error) {
        console.log('❌ Validation function error:', error.message);
    }
    
    console.log('\n');
}

/**
 * Check if our API routes have the validation in place
 */
async function checkAPIValidation() {
    console.log('🔧 Checking API Validation');
    console.log('==========================\n');
    
    try {
        // Check if our validation is imported in the API routes
        const fs = require('fs');
        
        const groupsRouteContent = fs.readFileSync('./app/api/groups/route.ts', 'utf8');
        const groupUpdateRouteContent = fs.readFileSync('./app/api/groups/[id]/route.ts', 'utf8');
        
        const hasCreateValidation = groupsRouteContent.includes('validateGroupForAPI');
        const hasUpdateValidation = groupUpdateRouteContent.includes('validateGroupForAPI');
        
        console.log('✅ API Route Validation Status:');
        console.log(`   Group Creation (POST): ${hasCreateValidation ? '✅ ENABLED' : '❌ MISSING'}`);
        console.log(`   Group Update (PUT): ${hasUpdateValidation ? '✅ ENABLED' : '❌ MISSING'}`);
        
        if (!hasCreateValidation || !hasUpdateValidation) {
            console.log('\n❌ WARNING: API validation is not properly implemented!');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Error checking API validation:', error.message);
        return false;
    }
}

/**
 * Main analysis function
 */
async function runCompleteAnalysis() {
    console.log('🚀 Complete Post-Cleanup Analysis\n');
    
    try {
        // 1. Analyze current database state
        await analyzePostCleanupState();
        
        // 2. Test prevention system
        await testPreventionSystem();
        
        // 3. Check API validation
        const apiValidationOk = await checkAPIValidation();
        
        // 4. Provide recommendations
        console.log('\n📋 RECOMMENDATIONS');
        console.log('==================');
        
        if (apiValidationOk) {
            console.log('✅ Prevention system is in place');
            console.log('✅ Future groups will be automatically protected');
        } else {
            console.log('❌ Need to implement API validation');
        }
        
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('1. If any problematic groups found → Run fix script');
        console.log('2. If API validation missing → Implement in routes');
        console.log('3. Create test groups to verify fix works');
        console.log('4. Monitor for any remaining issues');
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        return { success: false, error: error.message };
    }
}

// Run the complete analysis
if (require.main === module) {
    runCompleteAnalysis().then(result => {
        console.log('\n📊 Analysis Result:', result.success ? 'SUCCESS' : 'FAILED');
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    analyzePostCleanupState,
    testPreventionSystem,
    checkAPIValidation,
    runCompleteAnalysis
};
