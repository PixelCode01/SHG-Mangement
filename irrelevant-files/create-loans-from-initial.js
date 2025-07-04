const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createLoansFromInitialAmounts() {
  try {
    console.log('=== CREATING LOANS FROM INITIAL AMOUNTS ===');
    
    // Get memberships with initial loan amounts > 0
    const membershipsWithLoans = await prisma.memberGroupMembership.findMany({
      where: {
        groupId: '68381a2c05cb588247af871e',
        initialLoanAmount: { gt: 0 }
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            loans: {
              where: {
                groupId: '68381a2c05cb588247af871e',
                status: 'ACTIVE'
              }
            }
          }
        }
      }
    });

    console.log(`✅ Found ${membershipsWithLoans.length} memberships with initial loan amounts`);
    
    for (const membership of membershipsWithLoans) {
      console.log(`\n📋 Processing: ${membership.member.name}`);
      console.log(`   Initial Loan Amount: ₹${membership.initialLoanAmount}`);
      console.log(`   Existing Active Loans: ${membership.member.loans.length}`);
      
      if (membership.member.loans.length > 0) {
        console.log(`   ⚠️  Already has active loans, skipping`);
        continue;
      }
      
      // Create loan record
      const newLoan = await prisma.loan.create({
        data: {
          memberId: membership.member.id,
          groupId: '68381a2c05cb588247af871e',
          loanType: 'OTHER', // Default loan type for initial amounts
          originalAmount: membership.initialLoanAmount,
          currentBalance: membership.initialLoanAmount,
          interestRate: 0,
          status: 'ACTIVE',
          dateIssued: new Date()
        }
      });
      
      console.log(`   ✅ Created loan: ID ${newLoan.id}, Amount ₹${newLoan.amount}`);
    }
    
    console.log('\n🎉 All loans created successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createLoansFromInitialAmounts();
