const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixLoanMemberAssociation() {
  try {
    console.log('=== FIXING LOAN-MEMBER ASSOCIATION ===');
    
    // Find members by name and get their current IDs
    const santosh = await prisma.member.findFirst({
      where: { name: 'SANTOSH MISHRA' },
      orderBy: { createdAt: 'desc' } // Get the most recent one
    });
    
    const ashok = await prisma.member.findFirst({
      where: { name: 'ASHOK KUMAR KESHRI' },
      orderBy: { createdAt: 'desc' } // Get the most recent one
    });
    
    if (!santosh || !ashok) {
      console.log('Could not find members by name');
      return;
    }
    
    console.log(`Found SANTOSH MISHRA with ID: ${santosh.id}`);
    console.log(`Found ASHOK KUMAR KESHRI with ID: ${ashok.id}`);
    
    // Update loans to use the correct member IDs
    const santoshLoan = await prisma.loan.findFirst({
      where: { 
        currentBalance: 2400,
        status: 'ACTIVE'
      }
    });
    
    const ashokLoan = await prisma.loan.findFirst({
      where: { 
        currentBalance: 4800,
        status: 'ACTIVE'
      }
    });
    
    if (santoshLoan) {
      await prisma.loan.update({
        where: { id: santoshLoan.id },
        data: { memberId: santosh.id }
      });
      console.log(`Updated Santosh's loan to use member ID: ${santosh.id}`);
    }
    
    if (ashokLoan) {
      await prisma.loan.update({
        where: { id: ashokLoan.id },
        data: { memberId: ashok.id }
      });
      console.log(`Updated Ashok's loan to use member ID: ${ashok.id}`);
    }
    
    // Verify the update
    console.log('\n=== VERIFICATION ===');
    const updatedLoans = await prisma.loan.findMany({
      where: {
        groupId: '68381a2c05cb588247af871e',
        status: 'ACTIVE'
      },
      include: {
        member: {
          select: { name: true }
        }
      }
    });
    
    console.log(`Updated loans: ${updatedLoans.length}`);
    updatedLoans.forEach((loan, index) => {
      console.log(`  Loan ${index + 1}: Member ID ${loan.memberId}, Name: ${loan.member.name}, Balance: ${loan.currentBalance}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLoanMemberAssociation();
