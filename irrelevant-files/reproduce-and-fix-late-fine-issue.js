const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function reproduceLateFineFix() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('shg_management_dev');
        
        console.log('🚀 Starting Late Fine Issue Reproduction and Fix...\n');
        
        // Step 1: Create a test group with late fine enabled but missing tier rules
        console.log('📝 Step 1: Creating test group with problematic late fine setup...');
        
        const testGroupId = new ObjectId();
        const testGroup = {
            _id: testGroupId,
            name: "Test Group - Late Fine Issue",
            description: "Test group to reproduce late fine issue",
            creator: new ObjectId(),
            members: [],
            bankDetails: {
                accountNumber: "1234567890",
                bankName: "Test Bank",
                branchName: "Test Branch",
                ifscCode: "TEST0001234"
            },
            lateFineEnabled: true,
            contributionSettings: {
                amount: 100,
                collectionFrequency: "MONTHLY",
                collectionDay: 3,
                dueDate: 3
            },
            lateFineRule: {
                enabled: true,
                type: "TIER_BASED",
                // Missing tierRules - this is the bug!
                tierRules: [],
                gracePeriodDays: 0
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        await db.collection('groups').insertOne(testGroup);
        console.log(`✅ Created test group with ID: ${testGroupId}`);
        
        // Step 2: Create test members
        console.log('\n📝 Step 2: Creating test members...');
        
        const member1Id = new ObjectId();
        const member2Id = new ObjectId();
        
        const members = [
            {
                _id: member1Id,
                name: "Test Member 1",
                email: "member1@test.com",
                phone: "9876543210",
                groupId: testGroupId,
                joinedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: member2Id,
                name: "Test Member 2", 
                email: "member2@test.com",
                phone: "9876543211",
                groupId: testGroupId,
                joinedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        
        await db.collection('members').insertMany(members);
        
        // Update group with members
        await db.collection('groups').updateOne(
            { _id: testGroupId },
            { $set: { members: [member1Id, member2Id] } }
        );
        
        console.log(`✅ Created ${members.length} test members`);
        
        // Step 3: Create a period with overdue contributions
        console.log('\n📝 Step 3: Creating period with overdue contributions...');
        
        const periodId = new ObjectId();
        // Create a period that's overdue (last month)
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const period = {
            _id: periodId,
            groupId: testGroupId,
            month: lastMonth.getMonth() + 1,
            year: lastMonth.getFullYear(),
            dueDate: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 3),
            status: "ACTIVE",
            createdAt: lastMonth,
            updatedAt: new Date()
        };
        
        await db.collection('periods').insertOne(period);
        console.log(`✅ Created period for ${period.month}/${period.year}`);
        
        // Step 4: Create periodic records with missing contributions (overdue)
        console.log('\n📝 Step 4: Creating periodic records with overdue contributions...');
        
        const periodicRecords = [
            {
                _id: new ObjectId(),
                memberId: member1Id,
                groupId: testGroupId,
                periodId: periodId,
                month: period.month,
                year: period.year,
                contribution: 0, // Missing contribution
                lateFine: 0,     // Should be calculated but showing 0 due to bug
                loans: [],
                loanInterest: 0,
                status: "PENDING",
                createdAt: lastMonth,
                updatedAt: new Date()
            },
            {
                _id: new ObjectId(),
                memberId: member2Id,
                groupId: testGroupId,
                periodId: periodId,
                month: period.month,
                year: period.year,
                contribution: 50, // Partial contribution
                lateFine: 0,      // Should be calculated but showing 0 due to bug
                loans: [],
                loanInterest: 0,
                status: "PENDING",
                createdAt: lastMonth,
                updatedAt: new Date()
            }
        ];
        
        await db.collection('periodicrecords').insertMany(periodicRecords);
        console.log(`✅ Created ${periodicRecords.length} periodic records with overdue contributions`);
        
        // Step 5: Demonstrate the issue - calculate late fines
        console.log('\n🔍 Step 5: Demonstrating the late fine calculation issue...');
        
        const groupWithIssue = await db.collection('groups').findOne({ _id: testGroupId });
        console.log('Group late fine rule:', JSON.stringify(groupWithIssue.lateFineRule, null, 2));
        
        // Calculate days overdue
        const today = new Date();
        const dueDate = period.dueDate;
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        console.log(`Days overdue: ${daysOverdue}`);
        
        // Try to calculate late fine with missing tier rules
        const tierRules = groupWithIssue.lateFineRule.tierRules || [];
        console.log(`Number of tier rules: ${tierRules.length}`);
        console.log('❌ Issue: TIER_BASED late fine rule has no tier rules defined!');
        
        // Step 6: Fix the issue by adding default tier rules
        console.log('\n🔧 Step 6: Fixing the issue by adding default tier rules...');
        
        const defaultTierRules = [
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
        
        await db.collection('groups').updateOne(
            { _id: testGroupId },
            { 
                $set: { 
                    'lateFineRule.tierRules': defaultTierRules,
                    updatedAt: new Date()
                } 
            }
        );
        
        console.log('✅ Added default tier rules to the group');
        
        // Step 7: Recalculate late fines with proper tier rules
        console.log('\n📊 Step 7: Recalculating late fines with proper tier rules...');
        
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
        
        const lateFineAmount = calculateLateFine(daysOverdue, defaultTierRules);
        console.log(`Calculated late fine for ${daysOverdue} days overdue: ₹${lateFineAmount}`);
        
        // Update periodic records with calculated late fines
        const updates = await db.collection('periodicrecords').updateMany(
            { 
                groupId: testGroupId,
                periodId: periodId,
                contribution: { $lt: 100 } // Less than full contribution
            },
            { 
                $set: { 
                    lateFine: lateFineAmount,
                    updatedAt: new Date()
                } 
            }
        );
        
        console.log(`✅ Updated ${updates.modifiedCount} periodic records with late fines`);
        
        // Step 8: Create prevention mechanism
        console.log('\n🛡️ Step 8: Creating prevention mechanism...');
        
        // Check all groups for similar issues
        const allGroups = await db.collection('groups').find({
            lateFineEnabled: true,
            'lateFineRule.type': 'TIER_BASED'
        }).toArray();
        
        console.log(`Found ${allGroups.length} groups with TIER_BASED late fine rules`);
        
        let fixedGroups = 0;
        for (const group of allGroups) {
            if (!group.lateFineRule.tierRules || group.lateFineRule.tierRules.length === 0) {
                await db.collection('groups').updateOne(
                    { _id: group._id },
                    { 
                        $set: { 
                            'lateFineRule.tierRules': defaultTierRules,
                            updatedAt: new Date()
                        } 
                    }
                );
                fixedGroups++;
                console.log(`Fixed group: ${group.name} (${group._id})`);
            }
        }
        
        console.log(`✅ Fixed ${fixedGroups} groups with missing tier rules`);
        
        // Step 9: Verification
        console.log('\n✅ Step 9: Final verification...');
        
        const verificationGroup = await db.collection('groups').findOne({ _id: testGroupId });
        const verificationRecords = await db.collection('periodicrecords').find({ 
            groupId: testGroupId 
        }).toArray();
        
        console.log('\nFinal group late fine configuration:');
        console.log('- Late fine enabled:', verificationGroup.lateFineEnabled);
        console.log('- Late fine type:', verificationGroup.lateFineRule.type);
        console.log('- Number of tier rules:', verificationGroup.lateFineRule.tierRules.length);
        console.log('- Tier rules:', JSON.stringify(verificationGroup.lateFineRule.tierRules, null, 2));
        
        console.log('\nFinal periodic records:');
        verificationRecords.forEach((record, index) => {
            console.log(`Record ${index + 1}:`);
            console.log(`- Contribution: ₹${record.contribution}`);
            console.log(`- Late fine: ₹${record.lateFine}`);
        });
        
        console.log('\n🎉 Late Fine Issue Fix Complete!');
        console.log(`\nTest group ID: ${testGroupId}`);
        console.log(`Visit: http://localhost:3000/groups/${testGroupId}/contributions`);
        
        return {
            testGroupId: testGroupId.toString(),
            success: true,
            fixedGroups,
            message: 'Late fine issue reproduced and fixed successfully'
        };
        
    } catch (error) {
        console.error('❌ Error during late fine fix:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await client.close();
    }
}

// Run the script
reproduceLateFineFix().then(result => {
    console.log('\n📋 Final Result:', result);
}).catch(error => {
    console.error('Script failed:', error);
});
