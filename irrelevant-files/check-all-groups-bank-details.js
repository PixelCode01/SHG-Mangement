const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findGroupsWithBankDetails() {
  try {
    // First, let's check all groups and their bank details
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        bankAccountNumber: true,
        bankName: true
      },
      take: 10
    });
    
    console.log('All groups with bank details:');
    groups.forEach(group => {
      console.log(`${group.id}: ${group.name} - Bank: ${group.bankName || 'None'}, Account: ${group.bankAccountNumber || 'None'}`);
    });
    
    // Update a group that we know exists with bank details for testing
    if (groups.length > 0) {
      const firstGroup = groups[0];
      console.log(`\nUpdating group ${firstGroup.id} with test bank details...`);
      
      const updated = await prisma.group.update({
        where: { id: firstGroup.id },
        data: {
          bankAccountNumber: '9876543210987654',
          bankName: 'Test Bank of India'
        }
      });
      
      console.log('Updated group:', {
        id: updated.id,
        name: updated.name,
        bankAccountNumber: updated.bankAccountNumber,
        bankName: updated.bankName
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findGroupsWithBankDetails();
