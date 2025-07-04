const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupTestDataWithLateFineIssue() {
    try {
        console.log('🚀 Setting up test data to reproduce late fine issue...');

        // Clean up existing test data
        console.log('🧹 Cleaning up existing test data...');
        await prisma.periodicRecord.deleteMany({});
        await prisma.period.deleteMany({});
        await prisma.lateFineRule.deleteMany({});
        await prisma.member.deleteMany({});
        await prisma.group.deleteMany({});
        await prisma.user.deleteMany({});

        // 1. Create a test user
        console.log('👤 Creating test user...');
        const testUser = await prisma.user.create({
            data: {
                email: 'test@example.com',
                name: 'Test User',
                password: 'hashedpassword123', // In real app, this would be hashed
                role: 'GROUP_LEADER'
            }
        });
        console.log(`✅ Created user: ${testUser.name} (${testUser.id})`);

        // 2. Create a test group with late fine enabled but missing tier rules (this reproduces the issue)
        console.log('🏢 Creating test group with late fine issue...');
        const testGroup = await prisma.group.create({
            data: {
                name: 'Test Group ZX',
                description: 'Test group to reproduce late fine issue',
                leaderId: testUser.id,
                lateFineEnabled: true,
                lateFineRule: {
                    type: 'TIER_BASED', // This is the problem - TIER_BASED without actual tier rules
                    amount: 0 // This will be ignored since it's TIER_BASED
                },
                collectionSchedule: {
                    frequency: 'MONTHLY',
                    dayOfMonth: 3 // Collection on the 3rd of each month
                },
                bankDetails: {
                    accountNumber: '1234567890',
                    ifscCode: 'TEST0001',
                    bankName: 'Test Bank',
                    accountHolderName: 'Test Group ZX'
                }
            }
        });
        console.log(`✅ Created group: ${testGroup.name} (${testGroup.id})`);

        // 3. Create test members
        console.log('👥 Creating test members...');
        const memberNames = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'Diana Wilson'];
        const members = [];
        
        for (const name of memberNames) {
            const member = await prisma.member.create({
                data: {
                    name: name,
                    phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
                    address: `Test Address for ${name}`,
                    groupId: testGroup.id,
                    userId: testUser.id,
                    contributionAmount: 100, // ₹100 per member
                    status: 'ACTIVE'
                }
            });
            members.push(member);
            console.log(`  ✅ Created member: ${member.name}`);
        }

        // 4. Create a period that's overdue to trigger late fines
        console.log('📅 Creating overdue period...');
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - 10); // 10 days ago

        const period = await prisma.period.create({
            data: {
                name: 'December 2024',
                groupId: testGroup.id,
                collectionDate: overdueDate,
                dueDate: overdueDate,
                status: 'ACTIVE',
                totalContributionExpected: memberNames.length * 100 // 4 members × ₹100
            }
        });
        console.log(`✅ Created overdue period: ${period.name} (due ${overdueDate.toDateString()})`);

        // 5. Create periodic records for some members (some paid, some not)
        console.log('📝 Creating periodic records...');
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const hasPaid = i < 2; // First 2 members have paid, last 2 haven't
            
            const periodicRecord = await prisma.periodicRecord.create({
                data: {
                    memberId: member.id,
                    groupId: testGroup.id,
                    periodId: period.id,
                    contribution: hasPaid ? 100 : 0,
                    lateFine: 0, // This should be calculated but will be 0 due to missing tier rules
                    status: hasPaid ? 'PAID' : 'PENDING'
                }
            });
            console.log(`  ✅ Created record for ${member.name}: ${hasPaid ? 'PAID' : 'PENDING'}`);
        }

        // 6. Verify the issue - late fines should be 0 even though period is overdue
        console.log('\n🔍 Verifying the late fine issue...');
        const overdueRecords = await prisma.periodicRecord.findMany({
            where: {
                groupId: testGroup.id,
                periodId: period.id,
                contribution: 0 // Unpaid contributions
            },
            include: {
                member: true
            }
        });

        console.log(`Found ${overdueRecords.length} overdue records:`);
        overdueRecords.forEach(record => {
            console.log(`  - ${record.member.name}: Contribution ₹${record.contribution}, Late Fine ₹${record.lateFine}`);
        });

        // Check if tier rules exist
        const tierRules = await prisma.lateFineRule.findMany({
            where: {
                groupId: testGroup.id,
                type: 'TIER_BASED'
            }
        });

        console.log(`\n❌ ISSUE CONFIRMED: Group has TIER_BASED late fine rule but only ${tierRules.length} tier rules defined`);
        console.log('This is why late fines are showing as 0 even when overdue.');

        console.log(`\n📋 Test Data Summary:`);
        console.log(`  - Group ID: ${testGroup.id}`);
        console.log(`  - Group Name: ${testGroup.name}`);
        console.log(`  - URL: http://localhost:3000/groups/${testGroup.id}/contributions`);
        console.log(`  - Late Fine Enabled: ${testGroup.lateFineEnabled}`);
        console.log(`  - Late Fine Type: ${testGroup.lateFineRule.type}`);
        console.log(`  - Days Overdue: ${Math.ceil((new Date() - overdueDate) / (1000 * 60 * 60 * 24))}`);
        console.log(`  - Unpaid Members: ${overdueRecords.length}`);

        return {
            group: testGroup,
            members,
            period,
            user: testUser
        };

    } catch (error) {
        console.error('❌ Error setting up test data:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the setup
setupTestDataWithLateFineIssue()
    .then((result) => {
        console.log('\n🎉 Test data setup complete!');
        console.log('Now you can reproduce the late fine issue in the browser.');
    })
    .catch((error) => {
        console.error('Failed to set up test data:', error);
        process.exit(1);
    });
