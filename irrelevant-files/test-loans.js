console.log('Starting loan test...');

const { PrismaClient } = require('@prisma/client');

async function testLoans() {
  console.log('Creating Prisma client...');
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking loan count...');
    const loanCount = await prisma.loan.count();
    console.log(`Total loans: ${loanCount}`);
    
    if (loanCount > 0) {
      console.log('Fetching sample loans...');
      const loans = await prisma.loan.findMany({
        take: 5,
        select: {
          id: true,
          currentBalance: true,
          status: true,
          groupId: true,
          memberId: true,
          member: {
            select: {
              name: true
            }
          },
          group: {
            select: {
              name: true
            }
          }
        }
      });
      
      console.log('Sample loans:', JSON.stringify(loans, null, 2));
    }
    
    console.log('Checking specific group with loans...');
    const groupWithLoans = await prisma.group.findFirst({
      where: {
        loans: {
          some: {
            status: 'ACTIVE'
          }
        }
      },
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
    
    if (groupWithLoans) {
      console.log(`\nGroup with loans: ${groupWithLoans.name}`);
      let totalLoanBalance = 0;
      
      for (const membership of groupWithLoans.memberships) {
        const member = membership.member;
        const memberLoanBalance = member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
        totalLoanBalance += memberLoanBalance;
        
        if (memberLoanBalance > 0) {
          console.log(`  Member: ${member.name} - Loan balance: ${memberLoanBalance}`);
        }
      }
      
      console.log(`Total loan balance: ${totalLoanBalance}`);
    } else {
      console.log('No groups with active loans found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoans().catch(console.error);
