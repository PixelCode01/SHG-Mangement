/**
 * Simple test to check if session refresh works correctly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSessionRefresh() {
  try {
    console.log('Testing session refresh functionality...');
    
    // Find any existing user to test with
    const existingUser = await prisma.user.findFirst({
      include: {
        member: true
      }
    });
    
    if (!existingUser) {
      console.log('No existing users found. Create a user first.');
      return;
    }
    
    console.log(`Found user: ${existingUser.email} with role: ${existingUser.role}`);
    
    // Test the prisma query that would be used in the session callback
    const freshUserData = await prisma.user.findUnique({
      where: { id: existingUser.id },
      select: { role: true, memberId: true, email: true, name: true }
    });
    
    console.log('Fresh user data from database:', freshUserData);
    
    console.log('✅ Session refresh query works correctly');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSessionRefresh();
