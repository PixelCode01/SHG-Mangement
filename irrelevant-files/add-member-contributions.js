const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMemberContributions(groupId) {
    try {
        console.log('Adding member contributions to existing period...');
        
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
        
        const openPeriod = await prisma.groupPeriodicRecord.findFirst({
            where: {
                groupId: groupId,
                totalCollectionThisPeriod: null
            }
        });
        
        if (!group || !openPeriod) {
            console.log('Group or open period not found');
            return;
        }
        
        console.log(`Adding contributions for ${group.memberships.length} members to period ${openPeriod.recordSequenceNumber}`);
        
        // Update the membership loan amounts first to match what the debug shows
        const loanAmounts = [10000, 20000, 30000];
        for (let i = 0; i < group.memberships.length; i++) {
            await prisma.memberGroupMembership.update({
                where: {
                    id: group.memberships[i].id
                },
                data: {
                    currentLoanAmount: loanAmounts[i]
                }
            });
        }
        
        // Create member contributions with partial payments
        for (let i = 0; i < group.memberships.length; i++) {
            const membership = group.memberships[i];
            const member = membership.member;
            const loanAmount = loanAmounts[i];
            const expectedContribution = group.monthlyContribution || 500;
            const interestDue = loanAmount * ((group.interestRate || 0) / 100);
            const totalExpected = expectedContribution + interestDue;
            
            // Different payment scenarios:
            // Member 1: Paid only contribution, no interest
            // Member 2: Paid half of total due
            // Member 3: Paid everything
            let paidAmount;
            if (i === 0) {
                paidAmount = expectedContribution; // Only contribution
            } else if (i === 1) {
                paidAmount = totalExpected / 2; // Half payment
            } else {
                paidAmount = totalExpected; // Full payment
            }
            
            const remainingAmount = Math.max(0, totalExpected - paidAmount);
            const compulsoryPaid = Math.min(paidAmount, expectedContribution);
            const interestPaid = Math.max(0, paidAmount - expectedContribution);
            
            await prisma.memberContribution.create({
                data: {
                    groupPeriodicRecordId: openPeriod.id,
                    memberId: member.id,
                    compulsoryContributionDue: expectedContribution,
                    loanInterestDue: interestDue,
                    minimumDueAmount: totalExpected,
                    compulsoryContributionPaid: compulsoryPaid,
                    loanInterestPaid: interestPaid,
                    totalPaid: paidAmount,
                    remainingAmount: remainingAmount,
                    lateFineAmount: 0,
                    dueDate: new Date('2025-06-07'),
                    daysLate: 0,
                    status: remainingAmount > 0 ? 'PENDING' : 'PAID'
                }
            });
            
            console.log(`${member.name}: Expected ₹${totalExpected}, Paid ₹${paidAmount}, Remaining ₹${remainingAmount}`);
        }
        
        console.log('✅ Member contributions added successfully!');
        console.log('Now run: node debug-period-closing-fixed.js', groupId);
        
    } catch (error) {
        console.error('Error adding member contributions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

const groupId = process.argv[2];

if (!groupId) {
    console.log('Usage: node add-member-contributions.js <groupId>');
    process.exit(1);
}

addMemberContributions(groupId);
