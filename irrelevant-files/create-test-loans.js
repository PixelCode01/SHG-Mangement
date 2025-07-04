console.log('Creating test loan data...');

const { PrismaClient } = require('@prisma/client');

async function createTestLoans() {
  const prisma = new PrismaClient();
  
  try {
    // Get a group and its members
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });
    
    if (!group || group.memberships.length === 0) {
      console.log('No group with members found');
      return;
    }
    
    console.log(`Creating loans for group: ${group.name}`);
    
    // Create loans for the first few members
    const loansToCreate = group.memberships.slice(0, 3).map((membership, index) => ({
      groupId: group.id,
      memberId: membership.member.id,
      loanType: 'PERSONAL', // Valid enum value
      originalAmount: (index + 1) * 10000, // 10k, 20k, 30k
      interestRate: 0.12, // 12% annual
      dateIssued: new Date(),
      status: 'ACTIVE',
      currentBalance: (index + 1) * 10000, // Full amount outstanding
      grantorInfo: 'Test loan for periodic record calculation'
    }));
    
    console.log('Creating loans...');
    const createdLoans = await prisma.loan.createMany({
      data: loansToCreate
    });
    
    console.log(`Created ${createdLoans.count} loans`);
    
    // Verify the loans were created
    const verifyLoans = await prisma.loan.findMany({
      where: {
        groupId: group.id
      },
      include: {
        member: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('\nCreated loans:');
    verifyLoans.forEach(loan => {
      console.log(`  ${loan.member.name}: ₹${loan.currentBalance}`);
    });
    
    const totalLoanAmount = verifyLoans.reduce((sum, loan) => sum + loan.currentBalance, 0);
    console.log(`\nTotal loan amount: ₹${totalLoanAmount}`);
    
  } catch (error) {
    console.error('Error creating test loans:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLoans().catch(console.error);
