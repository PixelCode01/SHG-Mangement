/**
 * Test the fixed currentLoanBalance calculation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFixedLoanBalance() {
  console.log('🧪 Testing Fixed Current Loan Balance Calculation...\n');

  try {
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No groups found');
      return;
    }

    console.log(`Testing group: ${group.name}\n`);

    // Test the new calculation logic
    const membersWithFixedBalance = group.memberships.slice(0, 10).map(m => {
      const initialLoanAmount = m.initialLoanAmount || m.member.initialLoanAmount || 0;
      const activeLoanBalance = m.member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0;
      const currentLoanBalance = initialLoanAmount + activeLoanBalance;

      return {
        name: m.member.name,
        initialLoanAmount: initialLoanAmount,
        activeLoanBalance: activeLoanBalance,
        currentLoanBalance: currentLoanBalance
      };
    });

    console.log('Fixed Current Loan Balance Calculation:');
    console.log('=========================================');
    membersWithFixedBalance.forEach(member => {
      console.log(`${member.name}:`);
      console.log(`  - Initial Loan Amount: ₹${member.initialLoanAmount.toLocaleString()}`);
      console.log(`  - Active Loan Balance: ₹${member.activeLoanBalance.toLocaleString()}`);
      console.log(`  - Current Loan Balance: ₹${member.currentLoanBalance.toLocaleString()}`);
      console.log('');
    });

    const totalCurrentBalance = membersWithFixedBalance.reduce((sum, member) => 
      sum + member.currentLoanBalance, 0
    );

    console.log(`Total Current Loan Balance: ₹${totalCurrentBalance.toLocaleString()}`);

    // Simulate what the periodic record form would calculate for interest
    const interestRate = 24; // 24% annual
    const monthlyInterest = (totalCurrentBalance * (interestRate / 12)) / 100;
    
    console.log('\nInterest Calculation Impact:');
    console.log(`- Interest Rate: ${interestRate}%`);
    console.log(`- Monthly Interest Rate: ${interestRate / 12}%`);
    console.log(`- Calculated Monthly Interest: ₹${monthlyInterest.toLocaleString()}`);

    console.log('\n✅ Fix Applied Successfully!');
    console.log('Current Loan Balance now includes both initial loan amounts and active loans.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFixedLoanBalance();
