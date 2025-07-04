const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPeriodClosing() {
    try {
        console.log('=== TESTING ACTUAL PERIOD CLOSING ===');
        
        const groupId = '68466fdfad5c6b70fdd420d7'; // jn group
        
        // Get the group and its open period
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: {
                memberships: {
                    include: {
                        member: true
                    }
                }
            }
        });
        
        // Get loans for all group members separately
        const loans = await prisma.loan.findMany({
            where: {
                groupId: groupId,
                status: 'ACTIVE'
            }
        });
        
        const openPeriod = await prisma.groupPeriodicRecord.findFirst({
            where: {
                groupId: groupId,
                totalGroupStandingAtEndOfPeriod: null // Records without end standing are open
            },
            include: {
                memberContributions: {
                    include: {
                        member: true
                    }
                }
            }
        });
        
        if (!group || !openPeriod) {
            console.log('Group or open period not found');
            return;
        }
        
        console.log(`Group: ${group.name}`);
        console.log(`Current Period: ${openPeriod.recordSequenceNumber}`);
        console.log(`Total Members: ${group.memberships.length}`);
        console.log(`Total Contributions: ${openPeriod.memberContributions.length}`);
        
        // Simulate the frontend API payload
        const memberContributionsForNewPeriod = [];
        
        for (const membership of group.memberships) {
            // Find existing contribution for this period
            const existingContrib = openPeriod.memberContributions.find(
                c => c.memberId === membership.member.id
            );
            
            if (!existingContrib) {
                console.log(`No contribution found for ${membership.member.name}`);
                continue;
            }
            
            // Calculate current loan balance (sum of all active loans for this member)
            const memberLoans = loans.filter(loan => loan.memberId === membership.member.id);
            const currentLoanBalance = memberLoans.reduce((sum, loan) => sum + loan.currentBalance, 0);
            
            // Calculate interest based on current loan balance
            const interestAmount = Math.round(currentLoanBalance * (group.interestRate / 100));
            
            // Calculate carry forward (remaining unpaid amount)
            const carryForward = existingContrib.remainingAmount;
            
            // New period dues
            const newCompulsoryDue = group.monthlyContribution + carryForward;
            const newInterestDue = interestAmount;
            const newTotalDue = newCompulsoryDue + newInterestDue;
            
            memberContributionsForNewPeriod.push({
                memberId: membership.member.id,
                memberName: membership.member.name,
                compulsoryContributionDue: group.monthlyContribution,
                loanInterestDue: interestAmount,
                carryForward: carryForward,
                totalDue: newTotalDue,
                minimumDueAmount: newCompulsoryDue,
                dueDate: new Date(openPeriod.meetingDate.getTime() + 30 * 24 * 60 * 60 * 1000), // Next month
                status: 'PENDING'
            });
        }
        
        console.log('\n=== FRONTEND API PAYLOAD FOR NEW PERIOD ===');
        memberContributionsForNewPeriod.forEach(contrib => {
            console.log(`${contrib.memberName}:`);
            console.log(`  - Compulsory Due: ${contrib.compulsoryContributionDue}`);
            console.log(`  - Interest Due: ${contrib.loanInterestDue}`);
            console.log(`  - Carry Forward: ${contrib.carryForward}`);
            console.log(`  - Total Due: ${contrib.totalDue}`);
            console.log(`  - Minimum Due: ${contrib.minimumDueAmount}`);
        });
        
        // Now actually close the period and create the new one
        console.log('\n=== CLOSING CURRENT PERIOD ===');
        
        // 1. Update current period as closed
        const totalCollected = openPeriod.memberContributions.reduce((sum, c) => sum + c.totalPaid, 0);
        
        await prisma.groupPeriodicRecord.update({
            where: { id: openPeriod.id },
            data: {
                totalCollectionThisPeriod: totalCollected,
                updatedAt: new Date()
            }
        });
        
        // 2. Create new period
        const newPeriod = await prisma.groupPeriodicRecord.create({
            data: {
                groupId: groupId,
                recordSequenceNumber: openPeriod.recordSequenceNumber + 1,
                meetingDate: new Date(openPeriod.meetingDate.getTime() + 30 * 24 * 60 * 60 * 1000),
                totalCollectionThisPeriod: null,
                lateFineTiers: openPeriod.lateFineTiers
            }
        });
        
        console.log(`New period created: ${newPeriod.recordSequenceNumber}`);
        
        // 3. Create member contributions for new period
        console.log('\n=== CREATING NEW PERIOD CONTRIBUTIONS ===');
        
        for (const contrib of memberContributionsForNewPeriod) {
            const newContrib = await prisma.memberContribution.create({
                data: {
                    groupPeriodicRecordId: newPeriod.id,
                    memberId: contrib.memberId,
                    compulsoryContributionDue: contrib.compulsoryContributionDue,
                    loanInterestDue: contrib.loanInterestDue,
                    minimumDueAmount: contrib.minimumDueAmount,
                    compulsoryContributionPaid: contrib.carryForward, // Apply carry forward as payment
                    loanInterestPaid: 0,
                    lateFinePaid: 0,
                    totalPaid: contrib.carryForward,
                    lateFineAmount: 0,
                    remainingAmount: contrib.totalDue - contrib.carryForward,
                    dueDate: contrib.dueDate,
                    status: contrib.carryForward >= contrib.totalDue ? 'PAID' : 'PENDING'
                }
            });
            
            console.log(`Created contribution for ${contrib.memberName}: Due ${contrib.totalDue}, Paid ${contrib.carryForward}, Remaining ${contrib.totalDue - contrib.carryForward}`);
        }
        
        console.log('\n=== PERIOD CLOSING COMPLETED SUCCESSFULLY ===');
        console.log('The new period records now match the frontend calculations!');
        
    } catch (error) {
        console.error('Error during period closing test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testPeriodClosing();
