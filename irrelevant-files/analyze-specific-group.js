/**
 * Specific Group Late Fine Analysis
 * 
 * Analyzing group 684bae097517c05bab9a2eac that's showing ₹0 late fines
 * to identify the root cause and validate assumptions.
 */

const { MongoClient, ObjectId } = require('mongodb');
const { validateGroupForAPI, calculateLateFineFromAPIRules } = require('./late-fine-validation-js');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function analyzeSpecificGroup() {
    const client = new MongoClient(MONGODB_URI);
    const groupId = '684bae097517c05bab9a2eac';
    
    try {
        await client.connect();
        
        console.log('🔍 SPECIFIC GROUP ANALYSIS');
        console.log('========================');
        console.log(`Analyzing group: ${groupId}`);
        console.log(`URL: http://localhost:3000/groups/${groupId}/contributions\n`);
        
        // Check both possible databases
        const databases = ['shg_management', 'shg_management_dev'];
        let foundGroup = null;
        let foundDb = null;
        
        for (const dbName of databases) {
            console.log(`🔍 Checking database: ${dbName}`);
            const db = client.db(dbName);
            
            try {
                const group = await db.collection('groups').findOne({ 
                    _id: new ObjectId(groupId) 
                });
                
                if (group) {
                    foundGroup = group;
                    foundDb = dbName;
                    console.log(`✅ Found group in database: ${dbName}\n`);
                    break;
                } else {
                    console.log(`❌ Group not found in database: ${dbName}`);
                }
            } catch (error) {
                console.log(`❌ Error checking database ${dbName}:`, error.message);
            }
        }
        
        if (!foundGroup) {
            console.log('\n❌ GROUP NOT FOUND IN ANY DATABASE');
            console.log('\n🔍 POSSIBLE REASONS:');
            console.log('1. Group ID is incorrect');
            console.log('2. Group exists in a different database');
            console.log('3. Group was deleted');
            console.log('4. Database connection issue');
            
            return { success: false, error: 'Group not found' };
        }
        
        // Analyze the found group in detail
        const db = client.db(foundDb);
        
        console.log('📊 GROUP DETAILS');
        console.log('================');
        console.log(`Name: ${foundGroup.name || 'Unnamed'}`);
        console.log(`ID: ${foundGroup._id}`);
        console.log(`Created: ${foundGroup.createdAt || 'Unknown'}`);
        console.log(`Updated: ${foundGroup.updatedAt || 'Unknown'}`);
        
        // Analyze late fine configuration
        console.log('\n🔍 LATE FINE CONFIGURATION ANALYSIS');
        console.log('===================================');
        
        console.log('1. Late Fine Enabled Check:');
        console.log(`   - lateFineEnabled: ${foundGroup.lateFineEnabled}`);
        console.log(`   - lateFineRule exists: ${!!foundGroup.lateFineRule}`);
        
        if (foundGroup.lateFineRule) {
            console.log('\n2. Late Fine Rule Details:');
            console.log('   Raw rule:', JSON.stringify(foundGroup.lateFineRule, null, 4));
            
            console.log('\n3. Rule Configuration Analysis:');
            console.log(`   - isEnabled: ${foundGroup.lateFineRule.isEnabled}`);
            console.log(`   - enabled: ${foundGroup.lateFineRule.enabled}`);
            console.log(`   - type: ${foundGroup.lateFineRule.type}`);
            console.log(`   - ruleType: ${foundGroup.lateFineRule.ruleType}`);
            
            // Check tier rules
            const tierRules = foundGroup.lateFineRule.tierRules || foundGroup.lateFineRule.tiers || [];
            console.log(`   - tierRules length: ${tierRules.length}`);
            
            if (tierRules.length > 0) {
                console.log('   - tierRules:', JSON.stringify(tierRules, null, 4));
            } else {
                console.log('   ❌ ISSUE FOUND: No tier rules defined for TIER_BASED rule');
            }
        } else {
            console.log('   ❌ ISSUE FOUND: No late fine rule defined');
        }
        
        // Check contribution settings
        console.log('\n4. Contribution Settings:');
        if (foundGroup.contributionSettings) {
            console.log('   Settings:', JSON.stringify(foundGroup.contributionSettings, null, 4));
        } else {
            console.log('   ❌ No contribution settings found');
        }
        
        // Check for periodic records
        console.log('\n🔍 PERIODIC RECORDS ANALYSIS');
        console.log('============================');
        
        const periodicRecords = await db.collection('periodicrecords').find({
            groupId: new ObjectId(groupId)
        }).toArray();
        
        console.log(`Total periodic records: ${periodicRecords.length}`);
        
        if (periodicRecords.length > 0) {
            console.log('\nSample periodic records:');
            periodicRecords.slice(0, 3).forEach((record, index) => {
                console.log(`Record ${index + 1}:`);
                console.log(`  Member ID: ${record.memberId}`);
                console.log(`  Month/Year: ${record.month}/${record.year}`);
                console.log(`  Contribution: ₹${record.contribution || 0}`);
                console.log(`  Late Fine: ₹${record.lateFine || 0}`);
                console.log(`  Status: ${record.status}`);
                console.log(`  Created: ${record.createdAt}`);
                console.log('');
            });
            
            // Check for overdue records
            const overdueRecords = periodicRecords.filter(record => {
                const expectedAmount = foundGroup.contributionSettings?.amount || 100;
                return (record.contribution || 0) < expectedAmount && (record.lateFine || 0) === 0;
            });
            
            console.log(`❌ Records with incomplete contribution but ₹0 late fine: ${overdueRecords.length}`);
            
            if (overdueRecords.length > 0) {
                console.log('\nProblematic records:');
                overdueRecords.slice(0, 3).forEach((record, index) => {
                    console.log(`  Record ${index + 1}: Contribution ₹${record.contribution || 0}, Late Fine ₹${record.lateFine || 0}`);
                });
            }
        }
        
        // Check periods
        console.log('\n🔍 PERIODS ANALYSIS');
        console.log('==================');
        
        const periods = await db.collection('periods').find({
            groupId: new ObjectId(groupId)
        }).toArray();
        
        console.log(`Total periods: ${periods.length}`);
        
        if (periods.length > 0) {
            console.log('\nPeriod details:');
            periods.slice(0, 3).forEach((period, index) => {
                console.log(`Period ${index + 1}:`);
                console.log(`  Month/Year: ${period.month}/${period.year}`);
                console.log(`  Due Date: ${period.dueDate}`);
                console.log(`  Status: ${period.status}`);
                
                // Calculate if this period is overdue
                const today = new Date();
                const dueDate = new Date(period.dueDate);
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                console.log(`  Days overdue: ${daysOverdue}`);
                console.log('');
            });
        }
        
        // Test our validation system on this group
        console.log('\n🔧 VALIDATION SYSTEM TEST');
        console.log('=========================');
        
        const validationResult = validateGroupForAPI(foundGroup);
        console.log('Validation result:');
        console.log(`  - Is valid: ${validationResult.isValid}`);
        console.log(`  - Errors: ${JSON.stringify(validationResult.errors)}`);
        console.log(`  - Auto-fix would apply: ${validationResult.fixedData.lateFineRule?.tierRules?.length > 0 && (!foundGroup.lateFineRule?.tierRules || foundGroup.lateFineRule.tierRules.length === 0)}`);
        
        // Test late fine calculation
        if (foundGroup.lateFineRule?.tierRules?.length > 0) {
            console.log('\n📊 LATE FINE CALCULATION TEST');
            console.log('=============================');
            
            const testDays = [1, 5, 10, 15, 20, 30];
            testDays.forEach(days => {
                const lateFine = calculateLateFineFromAPIRules(days, foundGroup.lateFineRule.tierRules);
                console.log(`  ${days} days overdue: ₹${lateFine}`);
            });
        }
        
        return {
            success: true,
            group: foundGroup,
            database: foundDb,
            periodicRecordsCount: periodicRecords.length,
            periodsCount: periods.length,
            validationResult
        };
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await client.close();
    }
}

/**
 * Reflect on 5-7 possible sources of the problem
 */
function reflectOnPossibleSources() {
    console.log('\n🤔 REFLECTION: 5-7 POSSIBLE SOURCES OF THE PROBLEM');
    console.log('=====================================================\n');
    
    const possibleSources = [
        {
            id: 1,
            source: "Empty tierRules Array in Database",
            description: "Group has TIER_BASED late fine rule but tierRules array is empty",
            likelihood: "HIGH",
            reason: "This was the exact issue we fixed before and is most common"
        },
        {
            id: 2,
            source: "Frontend Calculation Logic Error",
            description: "Frontend is not properly calculating or displaying late fines",
            likelihood: "MEDIUM", 
            reason: "Frontend might not be using the correct API endpoint or logic"
        },
        {
            id: 3,
            source: "Periodic Records Not Updated",
            description: "Late fines are calculated but not saved to periodic records",
            likelihood: "MEDIUM",
            reason: "Calculation might work but persistence might be failing"
        },
        {
            id: 4,
            source: "Wrong Date/Period Calculation",
            description: "Due dates or overdue calculations are incorrect",
            likelihood: "MEDIUM",
            reason: "Date logic is complex and might have edge cases"
        },
        {
            id: 5,
            source: "API Validation Not Applied",
            description: "Our prevention system didn't catch this group during creation/update",
            likelihood: "LOW",
            reason: "We verified API validation is in place, but might have gaps"
        },
        {
            id: 6,
            source: "Database Schema Inconsistency", 
            description: "Different field names or structure than expected",
            likelihood: "LOW",
            reason: "Group might use different field names than our validation expects"
        },
        {
            id: 7,
            source: "Race Condition in Updates",
            description: "Late fine calculation gets overwritten by other updates",
            likelihood: "LOW",
            reason: "Multiple concurrent updates might be interfering"
        }
    ];
    
    possibleSources.forEach(source => {
        console.log(`${source.id}. ${source.source} [${source.likelihood} LIKELIHOOD]`);
        console.log(`   Description: ${source.description}`);
        console.log(`   Reason: ${source.reason}\n`);
    });
    
    console.log('📊 DISTILLED TO 1-2 MOST LIKELY SOURCES:');
    console.log('========================================');
    console.log('1. ⭐ PRIMARY: Empty tierRules Array in Database (HIGH likelihood)');
    console.log('   - Most common cause based on previous analysis');
    console.log('   - Matches the exact pattern we\'ve seen before');
    console.log('');
    console.log('2. ⭐ SECONDARY: Frontend Calculation Logic Error (MEDIUM likelihood)'); 
    console.log('   - Frontend might not be calling the right API or using correct logic');
    console.log('   - Could be displaying cached/stale data');
    
    return possibleSources;
}

/**
 * Main analysis function
 */
async function runSpecificGroupAnalysis() {
    console.log('🚀 ANALYZING SPECIFIC GROUP WITH ₹0 LATE FINES\n');
    
    // Reflect on possible sources
    const possibleSources = reflectOnPossibleSources();
    
    // Analyze the specific group
    const analysisResult = await analyzeSpecificGroup();
    
    console.log('\n🎯 ANALYSIS CONCLUSIONS');
    console.log('======================');
    
    if (analysisResult.success) {
        console.log('✅ Group found and analyzed');
        console.log('✅ Data extraction completed');
        console.log('✅ Validation system tested');
        
        // Provide specific recommendations based on findings
        console.log('\n📋 NEXT STEPS BASED ON ANALYSIS:');
        if (analysisResult.validationResult?.errors?.length > 0) {
            console.log('1. Apply auto-fix to this group');
            console.log('2. Verify fix resolves the issue');
        } else {
            console.log('1. Check frontend calculation logic');
            console.log('2. Verify periodic records are being updated correctly');
        }
        console.log('3. Test late fine calculation manually');
        console.log('4. Check for any cached data issues');
        
    } else {
        console.log('❌ Analysis failed - group not found or accessible');
        console.log('📋 NEXT STEPS: Verify group ID and database connectivity');
    }
    
    return analysisResult;
}

// Run the analysis
if (require.main === module) {
    runSpecificGroupAnalysis().then(result => {
        console.log('\n📊 Analysis Complete');
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = {
    analyzeSpecificGroup,
    reflectOnPossibleSources,
    runSpecificGroupAnalysis
};
