const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestPeriodWithData(groupId) {
    try {
        console.log(`Creating test period with contributions for group: ${groupId}`);
        
        // Get the group and its members
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
        
        if (!group) {
            console.log('Group not found');
            return;
        }
        
        console.log(`Found group: ${group.name} with ${group.memberships.length} members`);
        
        // Create a test period
        const testPeriod = await prisma.groupPeriodicRecord.create({
            data: {
                groupId: group.id,
                meetingDate: new Date('2025-06-07'),
                recordSequenceNumber: 1,
                totalCollectionThisPeriod: null, // Keep it open
                standingAtStartOfPeriod: (group.cashInHand || 0) + (group.balanceInBank || 0),
                membersPresent: group.memberships.length
            }
        });
        
        console.log(`Created period: ${testPeriod.id}, sequence: ${testPeriod.recordSequenceNumber}`);
        
        // Create member contributions with some test data
        const memberContributions = [];
        for (let i = 0; i < group.memberships.length; i++) {
            const membership = group.memberships[i];
            const member = membership.member;
            
            // Simulate some loan amounts
            const currentLoanAmount = membership.currentLoanAmount || (i % 2 === 0 ? 5000 : 0);
            const interestDue = currentLoanAmount * ((group.interestRate || 0) / 100);
            
            // Some members have paid partially, others haven't
            const expectedContribution = group.monthlyContribution || 500;
            const totalExpected = expectedContribution + interestDue;
            const paidAmount = i % 3 === 0 ? totalExpected : (i % 3 === 1 ? expectedContribution : 0); // Varied payment patterns
            const remainingAmount = Math.max(0, totalExpected - paidAmount);
            
            const contribution = await prisma.memberContribution.create({
                data: {
                    groupPeriodicRecordId: testPeriod.id,
                    memberId: member.id,
                    compulsoryContributionDue: expectedContribution,
                    loanInterestDue: interestDue,
                    minimumDueAmount: totalExpected,
                    compulsoryContributionPaid: Math.min(paidAmount, expectedContribution),
                    loanInterestPaid: Math.max(0, paidAmount - expectedContribution),
                    totalPaid: paidAmount,
                    remainingAmount: remainingAmount,
                    lateFineAmount: 0,
                    dueDate: new Date('2025-06-07'),
                    daysLate: 0,
                    status: remainingAmount > 0 ? 'PENDING' : 'COMPLETED'
                }
            });
            
            memberContributions.push(contribution);
            
            console.log(`Created contribution for ${member.name}: Expected: ₹${totalExpected}, Paid: ₹${paidAmount}, Remaining: ₹${remainingAmount}`);
        }
        
        console.log(`\n✅ Created test period with ${memberContributions.length} member contributions`);
        console.log(`📋 Group ID: ${groupId}`);
        console.log(`📋 Period ID: ${testPeriod.id}`);
        console.log(`🌐 Test at: http://localhost:3000/groups/${groupId}/contributions`);
        
    } catch (error) {
        console.error('Error creating test period:', error);
    } finally {
        await prisma.$disconnect();
    }
}

const groupId = process.argv[2];

if (!groupId) {
    console.log('Usage: node create-test-period-with-data.js <groupId>');
    process.exit(1);
}

createTestPeriodWithData(groupId);
