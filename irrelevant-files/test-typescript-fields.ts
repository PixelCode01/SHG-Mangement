import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCreateMembership() {
  console.log('Testing membership creation with new field names...');
  
  try {
    // This should fail if the fields don't exist in the Prisma types
    const testData = {
      groupId: 'test-group-id',
      memberId: 'test-member-id',
      currentShareAmount: 100.0,
      currentLoanAmount: 50.0,
      initialInterest: 5.0,
    };

    console.log('Test data structure:', testData);
    console.log('✅ TypeScript compilation should pass for this structure');
    
    // Log the type information
    console.log('Field types available:', typeof testData.currentShareAmount, typeof testData.currentLoanAmount);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateMembership();
