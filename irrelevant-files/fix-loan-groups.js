const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixLoanGroupAssociation() {
  try {
    console.log('=== CHECKING GROUPS ===');
    
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true
      }
    });
    
    console.log('Available groups:');
    groups.forEach(group => {
      console.log(`  ${group.id}: ${group.name}`);
    });
    
    const targetGroupId = '68381a2c05cb588247af871e';
    const targetGroup = groups.find(g => g.id === targetGroupId);
    
    if (!targetGroup) {
      console.log(`\nTarget group ${targetGroupId} not found!`);
      return;
    }
    
    console.log(`\nTarget group found: ${targetGroup.name}`);
    
    // Update loans to belong to the correct group
    console.log('\n=== UPDATING LOAN GROUP ASSOCIATIONS ===');
    
    const result = await prisma.loan.updateMany({
      where: {
        status: 'ACTIVE'
      },
      data: {
        groupId: targetGroupId
      }
    });
    
    console.log(`Updated ${result.count} loans to belong to group: ${targetGroup.name}`);
    
    // Verify the update
    console.log('\n=== VERIFYING UPDATE ===');
    const updatedLoans = await prisma.loan.findMany({
      where: {
        groupId: targetGroupId,
        status: 'ACTIVE'
      },
      include: {
        member: {
          select: { name: true }
        }
      }
    });
    
    console.log(`Loans now in target group: ${updatedLoans.length}`);
    updatedLoans.forEach((loan, index) => {
      console.log(`  Loan ${index + 1}: ${loan.member.name} - Balance: ${loan.currentBalance}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLoanGroupAssociation();
