const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFields() {
  try {
    console.log('Testing Prisma connection...');
    
    // Test if we can connect and check the schema
    const groups = await prisma.group.findMany({
      take: 1,
      select: {
        id: true,
        name: true,
        loanInsuranceBalance: true,
        groupSocialBalance: true,
        includeDataTillCurrentPeriod: true,
        currentPeriodMonth: true,
        currentPeriodYear: true
      }
    });
    
    console.log('✅ Successfully connected to database');
    console.log('✅ New fields are accessible in Prisma client');
    console.log('Sample data:', groups.length > 0 ? groups[0] : 'No groups found');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFields();
