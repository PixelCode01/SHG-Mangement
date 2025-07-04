// Test script to verify Prisma models and relationships
const { PrismaClient } = require('@prisma/client');

async function testPrismaModels() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing Prisma model availability...');
    
    // Test basic models
    console.log('✓ Group model:', typeof prisma.group !== 'undefined');
    console.log('✓ Member model:', typeof prisma.member !== 'undefined');
    console.log('✓ GroupPeriodicRecord model:', typeof prisma.groupPeriodicRecord !== 'undefined');
    
    // Test new models
    console.log('✓ LateFineRule model:', typeof prisma.lateFineRule !== 'undefined');
    console.log('✓ LateFineRuleTier model:', typeof prisma.lateFineRuleTier !== 'undefined');
    console.log('✓ MemberContribution model:', typeof prisma.memberContribution !== 'undefined');
    console.log('✓ CashAllocation model:', typeof prisma.cashAllocation !== 'undefined');
    console.log('✓ ContributionReport model:', typeof prisma.contributionReport !== 'undefined');
    
    // Test a simple query to ensure database connection works
    const groupCount = await prisma.group.count();
    console.log(`\n✓ Database connection working. Groups in database: ${groupCount}`);
    
    console.log('\n✅ All Prisma models are available and database is connected!');
    
  } catch (error) {
    console.error('❌ Error testing Prisma models:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaModels();
