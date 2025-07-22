// Simple test to check if we can connect to the database
const { PrismaClient } = require('@prisma/client');

async function quickTest() {
  const prisma = new PrismaClient();
  
  try {
    console.log("Testing database connection...");
    
    const memberCount = await prisma.member.count();
    console.log(`Found ${memberCount} members in the database`);
    
    const groupCount = await prisma.group.count();
    console.log(`Found ${groupCount} groups in the database`);
    
    // Get a sample member with family size
    const sampleMember = await prisma.member.findFirst({
      where: {
        familyMembersCount: {
          not: null
        }
      },
      select: {
        name: true,
        familyMembersCount: true
      }
    });
    
    if (sampleMember) {
      console.log(`Sample member with family size: ${sampleMember.name} - ${sampleMember.familyMembersCount} family members`);
    } else {
      console.log("No members found with family size data");
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
