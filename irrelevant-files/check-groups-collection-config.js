/**
 * Check available groups and their collection configuration
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGroupsConfiguration() {
  try {
    console.log('📋 Checking Groups Collection Configuration...\n');

    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        collectionFrequency: true,
        collectionDayOfMonth: true,
        collectionDayOfWeek: true,
        collectionWeekOfMonth: true,
        monthlyContribution: true,
        lateFineRules: {
          select: {
            id: true,
            isEnabled: true,
            ruleType: true,
            dailyAmount: true,
            dailyPercentage: true
          }
        }
      }
    });

    if (groups.length === 0) {
      console.log('❌ No groups found in database');
      return;
    }

    console.log(`Found ${groups.length} groups:\n`);

    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name || 'Unnamed Group'} (${group.id})`);
      console.log(`   Collection: ${group.collectionFrequency || 'Not set'}`);
      console.log(`   Day of Month: ${group.collectionDayOfMonth || 'Not set'}`);
      console.log(`   Day of Week: ${group.collectionDayOfWeek || 'Not set'}`);
      console.log(`   Week of Month: ${group.collectionWeekOfMonth || 'Not set'}`);
      console.log(`   Monthly Contribution: ₹${group.monthlyContribution || 'Not set'}`);
      
      if (group.lateFineRules?.length > 0) {
        const rule = group.lateFineRules[0];
        console.log(`   Late Fine Rule: ${rule.ruleType} (${rule.isEnabled ? 'Enabled' : 'Disabled'})`);
        if (rule.dailyAmount) console.log(`     Daily Amount: ₹${rule.dailyAmount}`);
        if (rule.dailyPercentage) console.log(`     Daily Percentage: ${rule.dailyPercentage}%`);
      } else {
        console.log(`   Late Fine Rule: None`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking groups:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGroupsConfiguration();
