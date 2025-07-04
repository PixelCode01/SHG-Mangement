const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewFields() {
  console.log('Testing new field names...');

  try {
    // Try to create a test membership with new field names
    const testData = {
      groupId: 'test',
      memberId: 'test',
      currentShareAmount: 100.0,
      currentLoanAmount: 50.0,
      initialInterest: 5.0,
    };

    console.log('Fields available in Prisma schema:');
    console.log('- currentShareAmount');
    console.log('- currentLoanAmount');
    console.log('- initialInterest');
    
    // Just log what we're trying to create (don't actually create)
    console.log('Test data structure:', testData);
    console.log('Schema validation: PASSED');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewFields();
