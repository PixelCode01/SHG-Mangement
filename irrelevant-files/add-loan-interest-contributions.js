const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addLoanInterestContributions() {
  try {
    // Find the test group
    const group = await prisma.group.findFirst({
      where: {
        name: 'Test Group for Late Fines'
      },
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('No test group found');
      return;
    }

    // Find the open period for this group (where totalCollectionThisPeriod is null/undefined)
    const openPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: group.id,
        totalCollectionThisPeriod: null
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });

    if (!openPeriod) {
      console.log('No open period found for test group');
      return;
    }

    console.log(`Found group: ${group.name} (ID: ${group.id})`);
    console.log(`Open period: ${openPeriod.id}`);

    // Calculate and add loan interest contributions for each member
    for (const membership of group.memberships) {
      const member = membership.member;
      console.log(`\nProcessing member: ${member.name}`);

      // Get active loans for this member in this group
      const loans = await prisma.loan.findMany({
        where: {
          memberId: member.id,
          groupId: group.id,
          status: 'ACTIVE'
        }
      });

      // Calculate current loan balance
      let currentLoanBalance = 0;
      for (const loan of loans) {
        currentLoanBalance += loan.currentBalance;
        console.log(`  Loan: ${loan.currentBalance} (Total: ${currentLoanBalance})`);
      }

      // Calculate interest due (using the same logic as frontend)
      const interestRate = group.interestRate || 0;
      const interestDue = currentLoanBalance * (interestRate / 100);
      
      console.log(`  Current loan balance: ${currentLoanBalance}`);
      console.log(`  Interest rate: ${interestRate}%`);
      console.log(`  Interest due: ${interestDue}`);

      // Check if member contribution already exists for this period
      const existingContribution = await prisma.memberContribution.findFirst({
        where: {
          memberId: membership.memberId,
          groupPeriodicRecordId: openPeriod.id
        }
      });

      if (existingContribution) {
        // Update existing contribution with loan interest
        if (interestDue > 0 && existingContribution.loanInterestDue !== interestDue) {
          await prisma.memberContribution.update({
            where: { id: existingContribution.id },
            data: {
              loanInterestDue: interestDue,
              loanInterestPaid: interestDue, // Assuming paid for testing
              minimumDueAmount: existingContribution.compulsoryContributionDue + interestDue,
              totalPaid: existingContribution.compulsoryContributionPaid + interestDue,
              status: 'PAID'
            }
          });
          console.log(`  ✓ Updated member contribution with loan interest: ${interestDue}`);
        } else {
          console.log(`  - Member contribution already has correct loan interest: ${existingContribution.loanInterestDue || 0}`);
        }
      } else {
        console.log(`  - No existing member contribution found for this period`);
      }
    }

    console.log('\n✓ Loan interest contributions added successfully');

  } catch (error) {
    console.error('Error adding loan interest contributions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addLoanInterestContributions();
