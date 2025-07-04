const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugLoanBalances() {
  try {
    console.log('=== DEBUG: Checking loan balances ===');
    console.log('Connecting to database...');
    
    // Get all groups with their members and loans
    const groups = await prisma.group.findMany({
      include: {
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
          }
        }
      }
    });

    console.log(`Found ${groups.length} groups`);
    
    for (const group of groups) {
      console.log(`\n--- Group: ${group.name} (${group.id}) ---`);
      console.log(`Members: ${group.memberships.length}`);
      console.log(`Financial data:`);
      console.log(`  - Cash in Hand: ${group.cashInHand || 0}`);
      console.log(`  - Balance in Bank: ${group.balanceInBank || 0}`);
      console.log(`  - Monthly Contribution: ${group.monthlyContribution || 0}`);
      console.log(`  - Interest Rate: ${group.interestRate || 0}%`);
      
      let totalLoanBalance = 0;
      
      for (const membership of group.memberships) {
        const member = membership.member;
        const memberLoanBalance = member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
        totalLoanBalance += memberLoanBalance;
        
        console.log(`  Member: ${member.name}`);
        console.log(`    - Active loans: ${member.loans.length}`);
        console.log(`    - Total loan balance: ${memberLoanBalance}`);
        
        if (member.loans.length > 0) {
          member.loans.forEach(loan => {
            console.log(`      Loan ${loan.id}: ${loan.currentBalance} (${loan.status})`);
          });
        }
      }
      
      const totalCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
      const totalGroupStanding = totalCash + totalLoanBalance;
      
      console.log(`\nGroup Standing Calculation:`);
      console.log(`  - Total Cash: ${totalCash}`);
      console.log(`  - Total Loan Balance: ${totalLoanBalance}`);
      console.log(`  - Total Group Standing: ${totalGroupStanding}`);
    }
    
  } catch (error) {
    console.error('Error debugging loan balances:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugLoanBalances().catch(console.error);
