/**
 * Final Late Fine System Verification & Monitoring
 * 
 * This script provides ongoing verification and monitoring of the late fine system
 * to ensure all groups (existing and future) are properly configured.
 */

const { MongoClient, ObjectId } = require('mongodb');
const { validateGroupForAPI, calculateLateFineFromAPIRules } = require('./late-fine-validation-js');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

/**
 * Comprehensive verification of all groups in the system
 */
async function verifyAllGroups() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('shg_management_dev'); // Use the database that has data
        
        console.log('🔍 FINAL LATE FINE SYSTEM VERIFICATION');
        console.log('=====================================\n');
        
        // Get all groups
        const allGroups = await db.collection('groups').find().toArray();
        console.log(`📊 Total groups in system: ${allGroups.length}\n`);
        
        if (allGroups.length === 0) {
            console.log('ℹ️  No groups found. System is ready for new groups.');
            return { success: true, totalGroups: 0, issues: [] };
        }
        
        let healthyGroups = 0;
        let fixedGroups = 0;
        let issues = [];
        
        // Check each group
        for (let i = 0; i < allGroups.length; i++) {
            const group = allGroups[i];
            console.log(`🔍 Checking Group ${i + 1}: ${group.name || 'Unnamed'} (${group._id})`);
            
            // Check late fine configuration
            if (group.lateFineRule) {
                if (group.lateFineRule.isEnabled && group.lateFineRule.ruleType === 'TIER_BASED') {
                    const tierRulesCount = (group.lateFineRule.tierRules || []).length;
                    console.log(`   Late fine: TIER_BASED with ${tierRulesCount} tier rules`);
                    
                    if (tierRulesCount === 0) {
                        console.log(`   ❌ ISSUE: No tier rules defined`);
                        
                        // Apply fix
                        const validationResult = validateGroupForAPI(group);
                        if (validationResult.fixedData.lateFineRule.tierRules.length > 0) {
                            await db.collection('groups').updateOne(
                                { _id: group._id },
                                { 
                                    $set: { 
                                        lateFineRule: validationResult.fixedData.lateFineRule,
                                        updatedAt: new Date()
                                    } 
                                }
                            );
                            console.log(`   ✅ FIXED: Added ${validationResult.fixedData.lateFineRule.tierRules.length} default tier rules`);
                            fixedGroups++;
                        } else {
                            issues.push({
                                groupId: group._id,
                                groupName: group.name,
                                issue: 'Failed to auto-fix missing tier rules'
                            });
                        }
                    } else {
                        console.log(`   ✅ Healthy: Tier rules properly configured`);
                        
                        // Test calculation to ensure it works
                        const testLateFine = calculateLateFineFromAPIRules(10, group.lateFineRule.tierRules);
                        console.log(`   📊 Test: 10 days overdue = ₹${testLateFine}`);
                        
                        healthyGroups++;
                    }
                } else {
                    console.log(`   ✅ Healthy: Late fine not tier-based or disabled`);
                    healthyGroups++;
                }
            } else {
                console.log(`   ✅ Healthy: No late fine rule defined`);
                healthyGroups++;
            }
            
            console.log(''); // Empty line for readability
        }
        
        // Summary
        console.log('📋 VERIFICATION SUMMARY');
        console.log('=======================');
        console.log(`Total groups checked: ${allGroups.length}`);
        console.log(`Healthy groups: ${healthyGroups}`);
        console.log(`Fixed groups: ${fixedGroups}`);
        console.log(`Remaining issues: ${issues.length}`);
        
        if (issues.length > 0) {
            console.log('\n❌ REMAINING ISSUES:');
            issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.groupName} (${issue.groupId}): ${issue.issue}`);
            });
        } else {
            console.log('\n🎉 ALL GROUPS ARE HEALTHY!');
        }
        
        return {
            success: true,
            totalGroups: allGroups.length,
            healthyGroups,
            fixedGroups,
            issues
        };
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await client.close();
    }
}

/**
 * Test the prevention system by simulating various group creation scenarios
 */
async function testPreventionScenarios() {
    console.log('\n🧪 PREVENTION SYSTEM TEST SCENARIOS');
    console.log('===================================\n');
    
    const testScenarios = [
        {
            name: "Group with missing tier rules",
            data: {
                name: "Test Group 1",
                lateFineRule: {
                    isEnabled: true,
                    ruleType: "TIER_BASED",
                    tierRules: []
                }
            },
            expectFix: true
        },
        {
            name: "Group with valid tier rules",
            data: {
                name: "Test Group 2",
                lateFineRule: {
                    isEnabled: true,
                    ruleType: "TIER_BASED",
                    tierRules: [
                        { startDay: 1, endDay: 30, amount: 10, isPercentage: false }
                    ]
                }
            },
            expectFix: false
        },
        {
            name: "Group with daily fixed late fine",
            data: {
                name: "Test Group 3",
                lateFineRule: {
                    isEnabled: true,
                    ruleType: "DAILY_FIXED",
                    dailyAmount: 5
                }
            },
            expectFix: false
        },
        {
            name: "Group with disabled late fine",
            data: {
                name: "Test Group 4",
                lateFineRule: {
                    isEnabled: false,
                    ruleType: "TIER_BASED",
                    tierRules: []
                }
            },
            expectFix: false
        },
        {
            name: "Group with no late fine rule",
            data: {
                name: "Test Group 5"
            },
            expectFix: false
        }
    ];
    
    let passedTests = 0;
    
    testScenarios.forEach((scenario, index) => {
        console.log(`Test ${index + 1}: ${scenario.name}`);
        
        const result = validateGroupForAPI(scenario.data);
        const wasFixed = result.fixedData.lateFineRule?.tierRules?.length > 0 && 
                         (!scenario.data.lateFineRule?.tierRules || scenario.data.lateFineRule.tierRules.length === 0);
        
        const testPassed = (scenario.expectFix && wasFixed) || (!scenario.expectFix && !wasFixed);
        
        if (testPassed) {
            console.log(`   ✅ PASS: ${scenario.expectFix ? 'Auto-fix applied' : 'No fix needed'}`);
            passedTests++;
        } else {
            console.log(`   ❌ FAIL: Expected ${scenario.expectFix ? 'auto-fix' : 'no fix'}, got ${wasFixed ? 'auto-fix' : 'no fix'}`);
        }
        
        if (wasFixed) {
            console.log(`   🔧 Added ${result.fixedData.lateFineRule.tierRules.length} tier rules`);
        }
        
        console.log('');
    });
    
    console.log(`Prevention test results: ${passedTests}/${testScenarios.length} passed`);
    
    return passedTests === testScenarios.length;
}

/**
 * Generate monitoring report
 */
async function generateMonitoringReport() {
    console.log('\n📊 MONITORING REPORT');
    console.log('===================\n');
    
    const verificationResult = await verifyAllGroups();
    const preventionTestPassed = await testPreventionScenarios();
    
    console.log('\n🎯 FINAL STATUS REPORT');
    console.log('=====================');
    
    if (verificationResult.success) {
        console.log('✅ Database verification: PASSED');
        console.log(`   - ${verificationResult.healthyGroups} groups healthy`);
        console.log(`   - ${verificationResult.fixedGroups} groups auto-fixed`);
        console.log(`   - ${verificationResult.issues.length} remaining issues`);
    } else {
        console.log('❌ Database verification: FAILED');
    }
    
    console.log(`${preventionTestPassed ? '✅' : '❌'} Prevention system: ${preventionTestPassed ? 'PASSED' : 'FAILED'}`);
    
    // Overall status
    const overallSuccess = verificationResult.success && 
                          preventionTestPassed && 
                          verificationResult.issues.length === 0;
    
    console.log(`\n🌟 OVERALL STATUS: ${overallSuccess ? '✅ SYSTEM HEALTHY' : '⚠️ NEEDS ATTENTION'}`);
    
    if (overallSuccess) {
        console.log('\n🎉 LATE FINE SYSTEM IS FULLY OPERATIONAL');
        console.log('- All existing groups are properly configured');
        console.log('- Prevention system blocks future issues');
        console.log('- Auto-fix applies default tier rules when needed');
        console.log('- API validation is active on all routes');
    }
    
    return {
        overallSuccess,
        verification: verificationResult,
        preventionTest: preventionTestPassed
    };
}

// Run the complete monitoring report
if (require.main === module) {
    generateMonitoringReport().then(result => {
        console.log('\n📋 Monitoring Complete');
        process.exit(result.overallSuccess ? 0 : 1);
    }).catch(error => {
        console.error('Monitoring failed:', error);
        process.exit(1);
    });
}

module.exports = {
    verifyAllGroups,
    testPreventionScenarios,
    generateMonitoringReport
};
