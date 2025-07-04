const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestGroupLeader() {
  console.log('=== Creating Test GROUP_LEADER User ===\n');

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: 'leader@test.com' }
    });

    if (existingUser) {
      console.log('Test user already exists:');
      console.log(`  Email: ${existingUser.email}`);
      console.log(`  Role: ${existingUser.role}`);
      console.log(`  Member ID: ${existingUser.memberId || 'NOT SET'}`);
      return;
    }

    // Create password hash
    const hashedPassword = await bcrypt.hash('leader123', 12);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: 'leader@test.com',
        role: 'GROUP_LEADER',
        name: 'Test Group Leader',
        password: hashedPassword
      }
    });

    console.log('✅ Created test GROUP_LEADER user:');
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Password: leader123`);
    console.log(`  Role: ${newUser.role}`);
    console.log(`  ID: ${newUser.id}`);
    console.log(`  Member ID: ${newUser.memberId || 'NOT SET'}`);
    console.log('');
    console.log('You can now log in with these credentials and test group creation!');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestGroupLeader();
