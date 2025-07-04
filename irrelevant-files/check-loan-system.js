// Check all loans in the database for ACHAL KUMAR OJHA
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== SEARCHING FOR ACHAL KUMAR OJHA LOANS ===');
    
    // Find ACHAL KUMAR OJHA
    const achal = await prisma.groupMember.findFirst({
      where: {
        name: 'ACHAL KUMAR OJHA'
      }
    });
    
    if (!achal) {
      console.log('ACHAL KUMAR OJHA not found');
      return;
    }
    
    console.log('ACHAL KUMAR OJHA found:', {
      id: achal.id,
      name: achal.name,
      initialLoanAmount: achal.initialLoanAmount
    });
    
    // Check all loans for this member
    const loans = await prisma.loan.findMany({
      where: {
        memberId: achal.id
      }
    });
    
    console.log('\n=== ALL LOANS FOR ACHAL KUMAR OJHA ===');
    console.log('Number of loans found:', loans.length);
    
    if (loans.length > 0) {
      loans.forEach((loan, index) => {
        console.log(`\nLoan ${index + 1}:`, {
          id: loan.id,
          amount: loan.amount,
          status: loan.status,
          interestRate: loan.interestRate,
          createdAt: loan.createdAt,
          startDate: loan.startDate,
          endDate: loan.endDate
        });
      });
    } else {
      console.log('No loans found for ACHAL KUMAR OJHA');
    }
    
    // Check all loans in the system to see if there are ANY loans
    const allLoans = await prisma.loan.findMany({
      take: 10,
      include: {
        member: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('\n=== SAMPLE OF ALL LOANS IN SYSTEM ===');
    console.log('Total loans found:', allLoans.length);
    
    if (allLoans.length > 0) {
      allLoans.forEach((loan, index) => {
        console.log(`\nLoan ${index + 1}:`, {
          id: loan.id,
          memberName: loan.member.name,
          amount: loan.amount,
          status: loan.status
        });
      });
    } else {
      console.log('No loans found in the entire system');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
