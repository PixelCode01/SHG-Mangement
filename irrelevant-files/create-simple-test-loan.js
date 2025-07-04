const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSimpleTestLoan() {
  console.log('🔧 Creating simple test loan for repayment testing...');
  
  try {
    // First, find an existing group
    const groups = await prisma.group.findMany({
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });
    
    if (groups.length === 0) {
      console.log('❌ No groups found. Please create a group first.');
      return;
    }
    
    const group = groups[0];
    console.log('✅ Using group:', group.name, 'ID:', group.id);
    
    if (group.memberships.length === 0) {
      console.log('❌ No members found in group. Please add members first.');
      return;
    }
    
    const member = group.memberships[0].member;
    console.log('✅ Using member:', member.name, 'ID:', member.id);
    
    // Create a test loan
    const testLoan = await prisma.loan.create({
      data: {
        groupId: group.id,
        memberId: member.id,
        loanType: 'PERSONAL',
        originalAmount: 5000,
        currentBalance: 5000,
        interestRate: 0.02, // 2%
        dateIssued: new Date(),
        status: 'ACTIVE',
        grantorInfo: 'Test loan for debugging'
      }
    });
    
    console.log('✅ Created test loan:', {
      id: testLoan.id,
      memberName: member.name,
      amount: testLoan.originalAmount,
      status: testLoan.status
    });
    
    console.log('\n🎯 TESTING INSTRUCTIONS:');
    console.log('1. Navigate to: http://localhost:3000/groups/' + group.id + '/contributions');
    console.log('2. Look for member:', member.name);
    console.log('3. Try to repay the loan amount');
    console.log('4. Check browser console for detailed logs starting with "🚀 LOAN REPAYMENT:"');
    console.log('5. Check network tab for API call to /api/groups/' + group.id + '/loans/repay');
    console.log('6. Look for any error messages in both frontend and backend logs');
    
  } catch (error) {
    console.error('❌ Error creating test loan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSimpleTestLoan().catch(console.error);
