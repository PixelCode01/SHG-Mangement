const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFieldsDirectly() {
  console.log('Testing field access with JavaScript (not TypeScript)...');
  
  try {
    // Try to find a membership and log all its fields
    const membership = await prisma.memberGroupMembership.findFirst();
    
    if (membership) {
      console.log('✅ Found membership record:');
      console.log('Available fields:', Object.keys(membership));
      
      // Check specifically for our fields
      const hasCurrentShare = 'currentShareAmount' in membership;
      const hasCurrentLoan = 'currentLoanAmount' in membership;
      
      console.log('Has currentShareAmount field:', hasCurrentShare);
      console.log('Has currentLoanAmount field:', hasCurrentLoan);
      
      if (hasCurrentShare || hasCurrentLoan) {
        console.log('✅ New field names are working in the database!');
      } else {
        console.log('❌ New field names not found in database record');
      }
    } else {
      console.log('No membership records found to test');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFieldsDirectly();
