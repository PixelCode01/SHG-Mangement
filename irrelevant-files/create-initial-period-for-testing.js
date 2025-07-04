const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createInitialPeriodForTesting() {
    try {
        console.log('=== CREATING INITIAL PERIOD FOR TESTING ===\n');
        
        // 1. Find any group to work with
        const groups = await prisma.group.findMany({
            include: {
                memberships: {
                    include: {
                        member: true
                    }
                }
            },
            take: 1
        });
        
        if (groups.length === 0) {
            console.log('❌ No groups found. Please create a group first through the frontend.');
            return;
        }
        
        const group = groups[0];
        console.log(`📊 Found group: ${group.name} (ID: ${group.id})`);
        console.log(`👥 Members: ${group.memberships.length}`);
        
        // 2. Check if there's already an active period
        const existingPeriod = await prisma.groupPeriodicRecord.findFirst({
            where: { 
                groupId: group.id,
                totalCollectionThisPeriod: null
            }
        });
        
        if (existingPeriod) {
            console.log(`✅ Active period already exists: ${existingPeriod.id}`);
            console.log('You can now test marking contributions as paid!');
            return;
        }
        
        // 3. Create a new period
        console.log('🆕 Creating new period...');
        
        const newPeriod = await prisma.groupPeriodicRecord.create({
            data: {
                groupId: group.id,
                meetingDate: new Date(),
                recordSequenceNumber: 1,
                standingAtStartOfPeriod: (group.cashInHand || 0) + (group.balanceInBank || 0),
                cashInHandAtEndOfPeriod: group.cashInHand || 0,
                cashInBankAtEndOfPeriod: group.balanceInBank || 0,
                totalGroupStandingAtEndOfPeriod: (group.cashInHand || 0) + (group.balanceInBank || 0),
                membersPresent: group.memberships.length,
                newContributionsThisPeriod: 0,
                interestEarnedThisPeriod: 0,
                lateFinesCollectedThisPeriod: 0,
                loanProcessingFeesCollectedThisPeriod: 0,
                expensesThisPeriod: 0
                // totalCollectionThisPeriod is left as null to keep the period "open"
            }
        });
        
        console.log(`✅ Created new period: ${newPeriod.id}`);
        
        // 4. Create member contribution records for each member
        console.log('👥 Creating member contribution records...');
        
        for (const membership of group.memberships) {
            const contribution = await prisma.memberContribution.create({
                data: {
                    groupPeriodicRecordId: newPeriod.id,
                    memberId: membership.memberId,
                    compulsoryContributionDue: group.monthlyContribution || 500,
                    loanInterestDue: 0,
                    minimumDueAmount: group.monthlyContribution || 500,
                    remainingAmount: group.monthlyContribution || 500,
                    status: 'PENDING',
                    compulsoryContributionPaid: 0,
                    loanInterestPaid: 0,
                    lateFinePaid: 0,
                    totalPaid: 0,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                    daysLate: 0,
                    lateFineAmount: 0
                }
            });
            
            console.log(`   ✓ ${membership.member.name}: ₹${group.monthlyContribution || 500} due`);
        }
        
        console.log('\n🎉 SETUP COMPLETE!');
        console.log(`📱 You can now visit: http://localhost:3001/groups/${group.id}/contributions`);
        console.log('🎯 Try marking some contributions as paid to test the functionality!');
        
    } catch (error) {
        console.error('❌ Error creating initial period:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createInitialPeriodForTesting();
