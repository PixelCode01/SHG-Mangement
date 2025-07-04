/**
 * Create a Test Group with Known Issues
 * 
 * This script creates a group with the exact same characteristics that would
 * cause ₹0 late fines, then tests our system against it.
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function createTestGroupWithIssue() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('shg_management_dev');
        
        console.log('🧪 Creating Test Group with Late Fine Issue');
        console.log('==========================================\n');
        
        // Create a group with the exact same ID pattern as reported
        const testGroupId = new ObjectId('684bae097517c05bab9a2eac'); // Use the reported ID
        
        const testGroup = {
            _id: testGroupId,
            name: "Test Group - Zero Late Fine Issue",
            description: "Group created to test the ₹0 late fine issue",
            creator: new ObjectId(),
            members: [new ObjectId(), new ObjectId()],
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
            // This is the problematic configuration
            lateFineRule: {
                isEnabled: true,
                ruleType: "TIER_BASED",
                tierRules: [], // Empty array - this causes ₹0 late fines!
                gracePeriodDays: 0
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('📝 Creating group with problematic late fine configuration...');
        console.log('Group ID:', testGroupId.toString());
        console.log('Late fine rule:', JSON.stringify(testGroup.lateFineRule, null, 2));
        
        try {
            await db.collection('groups').insertOne(testGroup);
            console.log('✅ Group created successfully');
        } catch (error) {
            if (error.code === 11000) {
                console.log('ℹ️  Group already exists, updating instead...');
                await db.collection('groups').replaceOne(
                    { _id: testGroupId },
                    testGroup
                );
                console.log('✅ Group updated successfully');
            } else {
                throw error;
            }
        }
        
        // Create some members
        console.log('\n📝 Creating test members...');
        const member1Id = testGroup.members[0];
        const member2Id = testGroup.members[1];
        
        const members = [
            {
                _id: member1Id,
                name: "Test Member 1",
                email: "testmember1@example.com",
                phone: "9876543210",
                groupId: testGroupId,
                joinedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: member2Id,
                name: "Test Member 2",
                email: "testmember2@example.com", 
                phone: "9876543211",
                groupId: testGroupId,
                joinedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        
        for (const member of members) {
            try {
                await db.collection('members').insertOne(member);
                console.log(`✅ Created member: ${member.name}`);
            } catch (error) {
                if (error.code === 11000) {
                    await db.collection('members').replaceOne(
                        { _id: member._id },
                        member
                    );
                    console.log(`✅ Updated member: ${member.name}`);
                } else {
                    console.log(`⚠️  Could not create member ${member.name}:`, error.message);
                }
            }
        }
        
        // Create a period that's overdue
        console.log('\n📝 Creating overdue period...');
        const periodId = new ObjectId();
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
        
        try {
            await db.collection('periods').insertOne(period);
            console.log('✅ Created overdue period');
        } catch (error) {
            if (error.code === 11000) {
                await db.collection('periods').replaceOne(
                    { _id: periodId },
                    period
                );
                console.log('✅ Updated overdue period');
            } else {
                console.log('⚠️  Could not create period:', error.message);
            }
        }
        
        // Create periodic records with missing contributions
        console.log('\n📝 Creating periodic records with overdue contributions...');
        
        const periodicRecords = [
            {
                _id: new ObjectId(),
                memberId: member1Id,
                groupId: testGroupId,
                periodId: periodId,
                month: period.month,
                year: period.year,
                contribution: 0,        // No contribution made
                lateFine: 0,           // This should be calculated but shows ₹0
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
                contribution: 50,       // Partial contribution
                lateFine: 0,           // This should be calculated but shows ₹0
                loans: [],
                loanInterest: 0,
                status: "PENDING",
                createdAt: lastMonth,
                updatedAt: new Date()
            }
        ];
        
        for (const record of periodicRecords) {
            try {
                await db.collection('periodicrecords').insertOne(record);
                console.log(`✅ Created periodic record for member ${record.memberId}`);
            } catch (error) {
                if (error.code === 11000) {
                    await db.collection('periodicrecords').replaceOne(
                        { _id: record._id },
                        record
                    );
                    console.log(`✅ Updated periodic record for member ${record.memberId}`);
                } else {
                    console.log(`⚠️  Could not create periodic record:`, error.message);
                }
            }
        }
        
        // Calculate and display the issue
        console.log('\n📊 DEMONSTRATING THE ISSUE');
        console.log('==========================');
        
        const today = new Date();
        const dueDate = period.dueDate;
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        console.log(`Due date: ${dueDate.toDateString()}`);
        console.log(`Today: ${today.toDateString()}`);
        console.log(`Days overdue: ${daysOverdue}`);
        console.log(`Expected contribution: ₹${testGroup.contributionSettings.amount}`);
        console.log('');
        console.log('❌ ISSUE: With empty tierRules array, late fine calculation returns ₹0');
        console.log('   Even though contributions are overdue, no late fine is applied');
        
        console.log('\\n🌐 TEST GROUP CREATED');
        console.log('=====================');
        console.log(`Group ID: ${testGroupId}`);
        console.log(`Group Name: ${testGroup.name}`);
        console.log(`URL: http://localhost:3000/groups/${testGroupId}/contributions`);
        console.log('');
        console.log('✅ You can now test this URL to see the ₹0 late fine issue');
        console.log('✅ The group has the exact same problem as reported');
        
        return {
            success: true,
            groupId: testGroupId.toString(),
            url: `http://localhost:3000/groups/${testGroupId}/contributions`,
            daysOverdue
        };
        
    } catch (error) {
        console.error('❌ Error creating test group:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await client.close();
    }
}

// Run the script
if (require.main === module) {
    createTestGroupWithIssue().then(result => {
        console.log('\\n📋 Result:', result);
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    createTestGroupWithIssue
};
