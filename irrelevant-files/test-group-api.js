console.log('Testing group API response...');

const { PrismaClient } = require('@prisma/client');

async function testGroupAPI() {
  const prisma = new PrismaClient();
  
  try {
    // Get the first group (should be the one with loans)
    const group = await prisma.group.findFirst({
      include: {
        leader: {
          select: { id: true, name: true, email: true }
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    status: 'ACTIVE'
                  }
                }
              }
            }
          },
          orderBy: {
            member: {
              name: 'asc'
            }
          }
        },
      },
    });

    if (!group) {
      console.log('No group found');
      return;
    }

    // Format the response like the API does
    const formattedGroup = {
      ...group,
      members: group.memberships.map(m => ({
        id: m.member.id,
        memberId: m.member.id,
        name: m.member.name,
        joinedAt: m.joinedAt,
        initialShareAmount: m.initialShareAmount || 0,
        initialLoanAmount: m.initialLoanAmount || m.member.initialLoanAmount || 0,
        initialInterest: m.initialInterest || 0,
        currentLoanBalance: m.member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0,
      })),
      cashInHand: group.cashInHand || 0,
      balanceInBank: group.balanceInBank || 0,
      monthlyContribution: group.monthlyContribution || 0,
      interestRate: group.interestRate || 0,
      memberships: undefined,
    };

    console.log('\nFormatted Group Response:');
    console.log(`Group: ${formattedGroup.name}`);
    console.log(`Financial Data:`);
    console.log(`  - Cash in Hand: ${formattedGroup.cashInHand}`);
    console.log(`  - Balance in Bank: ${formattedGroup.balanceInBank}`);
    console.log(`  - Monthly Contribution: ${formattedGroup.monthlyContribution}`);
    console.log(`  - Interest Rate: ${formattedGroup.interestRate}%`);
    
    console.log('\nMembers:');
    let totalLoanBalance = 0;
    formattedGroup.members.forEach(member => {
      console.log(`  ${member.name}: Loan Balance = ₹${member.currentLoanBalance}`);
      totalLoanBalance += member.currentLoanBalance;
    });
    
    const totalCash = formattedGroup.cashInHand + formattedGroup.balanceInBank;
    const totalGroupStanding = totalCash + totalLoanBalance;
    
    console.log('\nCalculations:');
    console.log(`  Total Cash: ₹${totalCash}`);
    console.log(`  Total Loan Balance: ₹${totalLoanBalance}`);
    console.log(`  Total Group Standing: ₹${totalGroupStanding}`);
    
    // Test interest calculation for monthly collection
    if (formattedGroup.interestRate > 0 && totalLoanBalance > 0) {
      const monthlyInterestRate = formattedGroup.interestRate / 12; // Annual to monthly
      const interestEarned = (totalLoanBalance * monthlyInterestRate) / 100;
      console.log(`  Monthly Interest Earned: ₹${interestEarned.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupAPI().catch(console.error);
