// Simplified debug script to check basic data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugBasicData() {
  try {
    console.log('🔍 [DEBUG] Checking basic group data...\n');
    
    // Check total groups
    const totalGroups = await prisma.group.count();
    console.log(`Total groups in database: ${totalGroups}`);
    
    // Check groups with Group Social enabled
    const groupsWithGS = await prisma.group.count({
      where: {
        groupSocialEnabled: true
      }
    });
    console.log(`Groups with Group Social enabled: ${groupsWithGS}`);
    
    // Get sample group data
    const sampleGroup = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                familyMembersCount: true
              }
            }
          }
        }
      }
    });
    
    if (sampleGroup) {
      console.log(`\nSample Group: ${sampleGroup.name}`);
      console.log(`Group Social Enabled: ${sampleGroup.groupSocialEnabled || false}`);
      console.log(`Group Social Amount Per Family: ${sampleGroup.groupSocialAmountPerFamilyMember || 0}`);
      console.log(`Member count: ${sampleGroup.memberships.length}`);
      
      if (sampleGroup.memberships.length > 0) {
        console.log('\nFirst 3 members:');
        sampleGroup.memberships.slice(0, 3).forEach((membership, index) => {
          const member = membership.member;
          console.log(`  ${index + 1}. ${member.name} - Family Size: ${member.familyMembersCount || 'null'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugBasicData();
