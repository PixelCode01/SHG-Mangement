/**
 * Script to fix collection days for existing groups
 * Sets default collection day of month to 1 for groups that have null values
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCollectionDays() {
  try {
    console.log('🔧 Fixing Collection Days for Existing Groups...\n');
    
    // Find all groups with null collection day of month
    const groupsWithNullDays = await prisma.group.findMany({
      where: {
        collectionDayOfMonth: null
      },
      select: {
        id: true,
        name: true,
        collectionFrequency: true,
        collectionDayOfMonth: true,
        collectionDayOfWeek: true
      }
    });
    
    console.log(`Found ${groupsWithNullDays.length} groups with null collection days:`);
    
    if (groupsWithNullDays.length === 0) {
      console.log('✅ All groups already have collection days set!');
      return;
    }
    
    // Update each group
    for (const group of groupsWithNullDays) {
      console.log(`\n📋 Updating group: ${group.name} (${group.id})`);
      console.log(`   Current frequency: ${group.collectionFrequency}`);
      console.log(`   Current day of month: ${group.collectionDayOfMonth}`);
      
      let updateData = {};
      
      // Set appropriate defaults based on frequency
      if (group.collectionFrequency === 'MONTHLY' || group.collectionFrequency === 'YEARLY') {
        updateData.collectionDayOfMonth = 1; // Default to 1st of month
        console.log(`   Setting collection day to: 1st of month`);
      } else if (group.collectionFrequency === 'WEEKLY' || group.collectionFrequency === 'FORTNIGHTLY') {
        if (!group.collectionDayOfWeek) {
          updateData.collectionDayOfWeek = 'MONDAY'; // Default to Monday
          console.log(`   Setting collection day to: Monday`);
        }
        if (group.collectionFrequency === 'FORTNIGHTLY') {
          updateData.collectionWeekOfMonth = 1; // Default to 1st week
          console.log(`   Setting collection week to: 1st week`);
        }
      }
      
      // Update the group
      if (Object.keys(updateData).length > 0) {
        await prisma.group.update({
          where: { id: group.id },
          data: updateData
        });
        console.log(`   ✅ Updated successfully`);
      } else {
        console.log(`   ⏭️ No update needed`);
      }
    }
    
    console.log('\n🎉 Collection day fix completed!');
    
    // Verify the fix
    const remainingNullGroups = await prisma.group.findMany({
      where: {
        AND: [
          {
            OR: [
              { collectionFrequency: 'MONTHLY' },
              { collectionFrequency: 'YEARLY' }
            ]
          },
          { collectionDayOfMonth: null }
        ]
      }
    });
    
    if (remainingNullGroups.length === 0) {
      console.log('✅ Verification passed: No monthly/yearly groups have null collection days');
    } else {
      console.log(`⚠️ Warning: ${remainingNullGroups.length} groups still have null collection days`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing collection days:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCollectionDays();
