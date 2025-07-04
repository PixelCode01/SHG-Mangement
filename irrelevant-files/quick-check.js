const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickCheck() {
  try {
    // Check if there are any late fine rules at all
    const lateFineRulesCount = await prisma.lateFineRule.count();
    console.log(`Total late fine rules in database: ${lateFineRulesCount}`);
    
    // Check some recent groups
    const recentGroups = await prisma.group.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        groupId: true,
        createdAt: true
      }
    });
    
    console.log('\nRecent groups:');
    recentGroups.forEach(group => {
      console.log(`- ${group.name} (${group.groupId})`);
    });
    
    // Check specific group with late fine rules if any
    const groupWithLateFine = await prisma.group.findFirst({
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      },
      where: {
        lateFineRules: {
          some: {}
        }
      }
    });
    
    if (groupWithLateFine) {
      console.log(`\nFound group with late fine: ${groupWithLateFine.name}`);
      console.log(`Late fine rules: ${groupWithLateFine.lateFineRules.length}`);
    } else {
      console.log('\nNo groups found with late fine rules');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickCheck();
