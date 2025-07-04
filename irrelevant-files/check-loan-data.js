const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLoanData() {
  try {
    console.log('=== CHECKING LOAN DATA ===');
    
    // Check all loans
    const loans = await prisma.loan.findMany({
      include: {
        member: {
          select: { name: true }
        },
        group: {
          select: { name: true }
        }
      }
    });
    
    console.log(`\nTotal loans found: ${loans.length}`);
    loans.forEach((loan, index) => {
      console.log(`\nLoan ${index + 1}:`);
      console.log(`  ID: ${loan.id}`);
      console.log(`  Member: ${loan.member.name}`);
      console.log(`  Group: ${loan.group.name}`);
      console.log(`  Amount: ${loan.amount}`);
      console.log(`  Current Balance: ${loan.currentBalance}`);
      console.log(`  Status: ${loan.status}`);
    });
    
    // Check members with initialLoanAmount
    console.log('\n=== CHECKING MEMBERS WITH INITIAL LOAN AMOUNTS ===');
    const membersWithLoans = await prisma.member.findMany({
      where: {
        OR: [
          { initialLoanAmount: { not: null } },
          { loans: { some: {} } }
        ]
      },
      include: {
        loans: true
      }
    });
    
    console.log(`\nMembers with loan data: ${membersWithLoans.length}`);
    membersWithLoans.forEach((member, index) => {
      console.log(`\nMember ${index + 1}:`);
      console.log(`  Name: ${member.name}`);
      console.log(`  Initial Loan Amount: ${member.initialLoanAmount}`);
      console.log(`  Active Loans: ${member.loans.length}`);
      member.loans.forEach((loan, loanIndex) => {
        console.log(`    Loan ${loanIndex + 1}: ${loan.amount} (Balance: ${loan.currentBalance}, Status: ${loan.status})`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLoanData();
