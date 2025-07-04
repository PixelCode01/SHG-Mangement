const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addBankDetails() {
  try {
    const groupId = '683c0f569d3d8075aa084255';
    
    // Update the group with bank details for testing
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        bankAccountNumber: '1234567890123456',
        bankName: 'State Bank of India'
      }
    });
    
    console.log('Updated group with bank details:', {
      id: updatedGroup.id,
      name: updatedGroup.name,
      bankAccountNumber: updatedGroup.bankAccountNumber,
      bankName: updatedGroup.bankName
    });
    
  } catch (error) {
    console.error('Error updating group:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addBankDetails();
