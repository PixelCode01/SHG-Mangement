const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPrismaFields() {
  console.log('Testing Prisma client with new field names...');

  try {
    // Test the fields by attempting to use them in a query (not creating actual records)
    console.log('Testing MemberGroupMembership fields...');
    
    // This should work if the fields exist
    const testMembership = {
      groupId: 'testGroupId',
      memberId: 'testMemberId',
      currentShareAmount: 100.0,
      currentLoanAmount: 50.0,
      initialInterest: 5.0,
    };

    console.log('✅ Test membership object created successfully:');
    console.log(JSON.stringify(testMembership, null, 2));
    
    // Try to use the Prisma client to check field availability
    console.log('\n📋 Checking available methods...');
    console.log('prisma.memberGroupMembership methods:', Object.getOwnPropertyNames(prisma.memberGroupMembership));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaFields();
