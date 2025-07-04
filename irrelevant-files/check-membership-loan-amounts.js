const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMembershipLoanAmounts() {
  try {
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
      console.log('Group not found');
      return;
    }

    console.log(`Group: ${group.name}`);
    console.log('\nMembership loan amounts:');
    
    for (const membership of group.memberships) {
      const member = membership.member;
      console.log(`  ${member.name}:`);
      console.log(`    - Membership currentLoanAmount: ${membership.currentLoanAmount}`);
      
      // Get actual loans
      const loans = await prisma.loan.findMany({
        where: {
          memberId: member.id,
          groupId: group.id,
          status: 'ACTIVE'
        }
      });
      
      const totalActualLoanBalance = loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      console.log(`    - Actual loan balance from Loan records: ${totalActualLoanBalance}`);
      console.log();
    }

  } catch (error) {
    console.error('Error checking membership loan amounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMembershipLoanAmounts();
