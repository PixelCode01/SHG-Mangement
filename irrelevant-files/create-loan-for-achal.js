const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createLoanForAchal() {
  try {
    console.log('=== CREATING LOAN FOR ACHAL KUMAR OJHA ===');
    
    // Find ACHAL KUMAR OJHA
    const achal = await prisma.member.findUnique({
      where: { id: '6838197405cb588247af8705' },
      select: {
        id: true,
        name: true,
        initialLoanAmount: true,
        loans: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!achal) {
      console.log('❌ ACHAL KUMAR OJHA not found');
      return;
    }

    console.log(`✅ Found: ${achal.name}`);
    console.log(`   Initial Loan Amount: ₹${achal.initialLoanAmount}`);
    console.log(`   Existing Active Loans: ${achal.loans.length}`);

    if (achal.loans.length > 0) {
      console.log('⚠️  ACHAL already has active loans');
      return;
    }

    if (!achal.initialLoanAmount || achal.initialLoanAmount === 0) {
      console.log('⚠️  ACHAL has no initial loan amount to convert');
      return;
    }

    // Create a loan record for ACHAL KUMAR OJHA
    const newLoan = await prisma.loan.create({
      data: {
        memberId: '6838197405cb588247af8705',
        groupId: '68381a2c05cb588247af871e', // The group ID we're working with
        amount: achal.initialLoanAmount,
        currentBalance: achal.initialLoanAmount,
        interestRate: 0,
        status: 'ACTIVE',
        disbursedAt: new Date()
      }
    });

    console.log('✅ Created loan for ACHAL KUMAR OJHA:');
    console.log(`   Loan ID: ${newLoan.id}`);
    console.log(`   Amount: ₹${newLoan.amount}`);
    console.log(`   Current Balance: ₹${newLoan.currentBalance}`);
    console.log(`   Status: ${newLoan.status}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createLoanForAchal();
