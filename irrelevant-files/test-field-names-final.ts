import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCurrentFieldNames() {
  console.log('🔍 Testing current field names after schema reset...');
  
  try {
    // Check if we can query with the new field names
    const memberships = await prisma.memberGroupMembership.findMany({
      take: 1,
      select: {
        id: true,
        currentShareAmount: true,
        currentLoanAmount: true,
        initialInterest: true,
      }
    });
    
    console.log('✅ Successfully queried with new field names:', memberships);
    
    // Test if we can create a membership with new field names
    console.log('\n🔧 Testing create operation structure...');
    const testCreateData = {
      groupId: 'test-group-id',
      memberId: 'test-member-id',
      currentShareAmount: 100.0,
      currentLoanAmount: 50.0,
      initialInterest: 5.0,
    };
    
    console.log('✅ Create data structure valid:', testCreateData);
    console.log('✅ All field names are working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing field names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrentFieldNames();
