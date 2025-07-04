const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSunitaLoans() {
  try {
    // Find SUNITA KUMARI
    const member = await prisma.member.findFirst({
      where: {
        name: 'SUNITA KUMARI'
      },
      include: {
        memberships: {
          include: {
            group: true
          }
        }
      }
    });

    if (!member) {
      console.log('SUNITA KUMARI not found');
      return;
    }

    console.log(`Found member: ${member.name} (ID: ${member.id})`);
    console.log(`Current loan amount in member record: ${member.currentLoanAmount}`);

    // Find all loans for SUNITA
    const loans = await prisma.loan.findMany({
      where: {
        memberId: member.id
      },
      include: {
        group: {
          select: { name: true }
        }
      }
    });

    console.log(`\nLoans for SUNITA KUMARI: ${loans.length}`);
    loans.forEach(loan => {
      console.log(`  Group: ${loan.group.name}`);
      console.log(`  Original: ${loan.originalAmount}, Current: ${loan.currentBalance}`);
      console.log(`  Status: ${loan.status}`);
      console.log(`  Date Issued: ${loan.dateIssued}`);
      console.log();
    });

    // Check if she has a member contribution record for the test group
    const testGroup = await prisma.group.findFirst({
      where: { name: 'Test Group for Late Fines' }
    });

    if (testGroup) {
      const openPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: {
          groupId: testGroup.id,
          totalCollectionThisPeriod: null
        }
      });

      if (openPeriod) {
        const contribution = await prisma.memberContribution.findFirst({
          where: {
            memberId: member.id,
            groupPeriodicRecordId: openPeriod.id
          }
        });

        console.log(`Member contribution record exists: ${!!contribution}`);
        if (contribution) {
          console.log(`  Compulsory Due: ${contribution.compulsoryContributionDue}`);
          console.log(`  Interest Due: ${contribution.loanInterestDue}`);
        }
      }
    }

  } catch (error) {
    console.error('Error checking SUNITA loans:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSunitaLoans();
