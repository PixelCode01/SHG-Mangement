const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMissingSunitaContribution() {
    try {
        console.log('Adding missing contribution for SUNITA KUMARI...');
        
        const groupId = '684400d1886d8f498b00f865';
        
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
        
        // Find SUNITA KUMARI
        const sunitaMembership = group.memberships.find(m => 
            m.member.name === 'SUNITA KUMARI'
        );
        
        if (!sunitaMembership) {
            console.log('SUNITA KUMARI not found');
            return;
        }
        
        // Check if contribution already exists
        const existingContribution = await prisma.memberContribution.findUnique({
            where: {
                groupPeriodicRecordId_memberId: {
                    groupPeriodicRecordId: openPeriod.id,
                    memberId: sunitaMembership.member.id
                }
            }
        });
        
        if (existingContribution) {
            console.log('SUNITA KUMARI already has a contribution record');
            return;
        }
        
        // Set her loan amount first
        await prisma.memberGroupMembership.update({
            where: {
                id: sunitaMembership.id
            },
            data: {
                currentLoanAmount: 30000
            }
        });
        
        // Create her contribution record - she hasn't paid anything yet
        const expectedContribution = group.monthlyContribution;
        const expectedInterest = Math.round(30000 * (group.interestRate / 100));
        
        await prisma.memberContribution.create({
            data: {
                groupPeriodicRecordId: openPeriod.id,
                memberId: sunitaMembership.member.id,
                compulsoryContributionDue: expectedContribution,
                loanInterestDue: expectedInterest,
                minimumDueAmount: expectedContribution + expectedInterest,
                compulsoryContributionPaid: 0,
                loanInterestPaid: 0,
                lateFinePaid: 0,
                totalPaid: 0,
                lateFineAmount: 0,
                remainingAmount: expectedContribution + expectedInterest,
                dueDate: new Date('2025-06-07T00:00:00.000Z'),
                status: 'PENDING'
            }
        });
        
        console.log('Successfully added contribution record for SUNITA KUMARI');
        console.log(`- Compulsory Due: ${expectedContribution}`);
        console.log(`- Loan Interest Due: ${expectedInterest}`);
        console.log(`- Minimum Due: ${expectedContribution + expectedInterest}`);
        console.log(`- Total Paid: 0`);
        console.log(`- Remaining: ${expectedContribution + expectedInterest}`);
        
    } catch (error) {
        console.error('Error adding SUNITA contribution:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addMissingSunitaContribution();
