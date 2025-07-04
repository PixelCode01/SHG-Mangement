const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database contents...');
    
    // Check users
    const users = await prisma.user.findMany();
    console.log(`Users: ${users.length}`);
    
    // Check groups
    const groups = await prisma.group.findMany({
      include: {
        leader: { select: { name: true } },
        lateFineRules: true
      }
    });
    console.log(`Groups: ${groups.length}`);
    
    if (groups.length > 0) {
      groups.forEach(group => {
        console.log(`\nGroup: ${group.name}`);
        console.log(`Leader: ${group.leader?.name || 'No leader'}`);
        console.log(`Late Fine Rules: ${group.lateFineRules.length}`);
        console.log(`Monthly Contribution: ${group.monthlyContribution || 'Not set'}`);
        console.log(`Interest Rate: ${group.interestRate || 'Not set'}`);
      });
    }
    
    // Check memberships
    const memberships = await prisma.memberGroupMembership.findMany();
    console.log(`\nMemberships: ${memberships.length}`);
    
    // Check contribution records
    const contributions = await prisma.memberContribution.findMany();
    console.log(`Contribution Records: ${contributions.length}`);
    
    // Check periodic records
    const periodicRecords = await prisma.groupPeriodicRecord.findMany();
    console.log(`Periodic Records: ${periodicRecords.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
