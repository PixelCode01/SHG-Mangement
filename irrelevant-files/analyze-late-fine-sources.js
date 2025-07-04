/**
 * Late Fine Issue Analysis and Logging
 * 
 * This script will help us identify the root causes of why late fines
 * are still showing as 0 for group 684ab648ba9fb9c7e6784ca5
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

/**
 * POSSIBLE SOURCES OF THE PROBLEM:
 * 
 * 1. DATABASE SCHEMA MISMATCH: The database might be using different field names 
 *    than our validation expects (e.g., 'type' vs 'ruleType', different tier structure)
 * 
 * 2. MULTIPLE DATABASES: We might be fixing one database while the frontend 
 *    reads from another (e.g., 'shg_management' vs 'shg_management_dev')
 * 
 * 3. FRONTEND CALCULATION LOGIC: The frontend might have its own late fine 
 *    calculation that doesn't match our backend fixes
 * 
 * 4. PERIODIC RECORDS NOT UPDATED: The late fine values might be pre-calculated 
 *    and stored in periodic records, not calculated on-the-fly
 * 
 * 5. CACHING ISSUES: The application might be caching old group data or 
 *    late fine calculations
 * 
 * 6. API ROUTE NOT BEING USED: Our validation might be in place but the 
 *    group creation/update might be happening through different routes
 * 
 * 7. DIFFERENT LATE FINE RULE STRUCTURE: The actual database structure might 
 *    be different from what we assumed in our validation
 */

async function analyzeLateFineProblem() {
    console.log('🔍 LATE FINE PROBLEM ANALYSIS');
    console.log('=============================\n');
    
    const problemGroupId = '684ab648ba9fb9c7e6784ca5';
    console.log(`📋 Analyzing Group: ${problemGroupId}`);
    console.log(`🌐 Frontend URL: http://localhost:3000/groups/${problemGroupId}/contributions\n`);
    
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        
        // Check both possible databases
        const databases = ['shg_management', 'shg_management_dev'];
        
        for (const dbName of databases) {
            console.log(`\n🗄️ CHECKING DATABASE: ${dbName}`);
            console.log('='.repeat(40));
            
            const db = client.db(dbName);
            
            // 1. Check if the group exists in this database
            const group = await db.collection('groups').findOne({ 
                _id: new ObjectId(problemGroupId) 
            });
            
            if (!group) {
                console.log(`❌ Group not found in ${dbName}`);
                continue;
            }
            
            console.log(`✅ Group found in ${dbName}: "${group.name}"`);
            
            // 2. Analyze the late fine rule structure
            console.log('\n📊 LATE FINE RULE ANALYSIS:');
            console.log(JSON.stringify(group.lateFineRule || group.lateFineEnabled, null, 2));
            
            // Check different possible field variations
            const lateFineFields = [
                'lateFineRule',
                'lateFineEnabled', 
                'lateFineSetting',
                'fineSetting'
            ];
            
            console.log('\n🔎 CHECKING ALL POSSIBLE LATE FINE FIELDS:');
            lateFineFields.forEach(field => {
                if (group[field] !== undefined) {
                    console.log(`  ${field}:`, JSON.stringify(group[field], null, 2));
                }
            });
            
            // 3. Check periodic records for this group
            const periodicRecords = await db.collection('periodicrecords').find({
                groupId: new ObjectId(problemGroupId)
            }).limit(5).toArray();
            
            console.log(`\n📝 PERIODIC RECORDS (last 5):`);
            periodicRecords.forEach((record, index) => {
                console.log(`  Record ${index + 1}:`);
                console.log(`    Member: ${record.memberId}`);
                console.log(`    Period: ${record.month}/${record.year}`);
                console.log(`    Contribution: ₹${record.contribution || 0}`);
                console.log(`    Late Fine: ₹${record.lateFine || 0}`);
                console.log(`    Status: ${record.status}`);
                console.log(`    Updated: ${record.updatedAt}`);
            });
            
            // 4. Check current period and due dates
            const currentPeriods = await db.collection('periods').find({
                groupId: new ObjectId(problemGroupId)
            }).sort({ year: -1, month: -1 }).limit(3).toArray();
            
            console.log(`\n📅 RECENT PERIODS:`);
            currentPeriods.forEach((period, index) => {
                const today = new Date();
                const dueDate = new Date(period.dueDate);
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                
                console.log(`  Period ${index + 1}:`);
                console.log(`    ${period.month}/${period.year}`);
                console.log(`    Due Date: ${dueDate.toDateString()}`);
                console.log(`    Days Overdue: ${daysOverdue}`);
                console.log(`    Status: ${period.status}`);
            });
            
            // 5. Check group members
            const members = await db.collection('members').find({
                groupId: new ObjectId(problemGroupId)
            }).toArray();
            
            console.log(`\n👥 GROUP MEMBERS: ${members.length} members`);
            members.slice(0, 3).forEach((member, index) => {
                console.log(`  ${index + 1}. ${member.name} (${member._id})`);
            });
        }
        
        // 6. Test our validation function on this group
        console.log('\n🧪 TESTING OUR VALIDATION LOGIC:');
        console.log('='.repeat(40));
        
        // Simulate what our frontend calculation might be doing
        const testGroup = await client.db('shg_management').collection('groups').findOne({ 
            _id: new ObjectId(problemGroupId) 
        });
        
        if (testGroup && testGroup.lateFineRule) {
            console.log('Group late fine rule found:');
            console.log(JSON.stringify(testGroup.lateFineRule, null, 2));
            
            // Test different calculation scenarios
            const testDaysOverdue = [1, 5, 10, 20, 30];
            testDaysOverdue.forEach(days => {
                const fine = calculateLateFineForTesting(days, testGroup.lateFineRule);
                console.log(`  ${days} days overdue: ₹${fine}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    } finally {
        await client.close();
    }
}

function calculateLateFineForTesting(daysOverdue, lateFineRule) {
    console.log(`\n🧮 TESTING CALCULATION for ${daysOverdue} days:`);
    console.log(`  Rule type: ${lateFineRule?.ruleType || lateFineRule?.type || 'undefined'}`);
    console.log(`  Rule enabled: ${lateFineRule?.isEnabled || lateFineRule?.enabled || 'undefined'}`);
    console.log(`  Tier rules count: ${lateFineRule?.tierRules?.length || 0}`);
    
    if (!lateFineRule) {
        console.log('  ❌ No late fine rule found');
        return 0;
    }
    
    const isEnabled = lateFineRule.isEnabled || lateFineRule.enabled;
    const ruleType = lateFineRule.ruleType || lateFineRule.type;
    const tierRules = lateFineRule.tierRules;
    
    if (!isEnabled) {
        console.log('  ❌ Late fines not enabled');
        return 0;
    }
    
    if (ruleType !== 'TIER_BASED') {
        console.log(`  ❌ Not tier-based (type: ${ruleType})`);
        return 0;
    }
    
    if (!tierRules || tierRules.length === 0) {
        console.log('  ❌ No tier rules defined');
        return 0;
    }
    
    console.log('  📊 Available tier rules:');
    tierRules.forEach((tier, index) => {
        console.log(`    ${index + 1}. Days ${tier.startDay || tier.minDays}-${tier.endDay || tier.maxDays}: ₹${tier.amount || tier.fineAmount} ${tier.isPercentage ? '%' : 'per day'}`);
    });
    
    // Find applicable tier
    const applicableTier = tierRules.find(tier => {
        const startDay = tier.startDay || tier.minDays;
        const endDay = tier.endDay || tier.maxDays;
        return daysOverdue >= startDay && (endDay === null || endDay === 9999 || daysOverdue <= endDay);
    });
    
    if (!applicableTier) {
        console.log(`  ❌ No applicable tier found for ${daysOverdue} days`);
        return 0;
    }
    
    console.log(`  ✅ Found applicable tier: Days ${applicableTier.startDay || applicableTier.minDays}-${applicableTier.endDay || applicableTier.maxDays}`);
    
    const amount = applicableTier.amount || applicableTier.fineAmount;
    const isPercentage = applicableTier.isPercentage;
    
    if (isPercentage) {
        console.log(`  💰 Percentage-based: ${amount}%`);
        return amount; // Would need contribution amount to calculate
    } else {
        const fine = daysOverdue * amount;
        console.log(`  💰 Per-day calculation: ${daysOverdue} × ₹${amount} = ₹${fine}`);
        return fine;
    }
}

// Run the analysis
analyzeLateFineProblem().then(() => {
    console.log('\n🎯 ANALYSIS COMPLETE');
    console.log('\nNext steps based on findings:');
    console.log('1. Check which database the frontend is actually using');
    console.log('2. Verify the late fine rule structure matches our expectations');
    console.log('3. Check if periodic records need to be recalculated');
    console.log('4. Ensure our validation is being applied to the correct database');
}).catch(error => {
    console.error('Analysis script failed:', error);
});
