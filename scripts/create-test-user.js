// Basic test script
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

console.log('Script starting...');

async function checkUsers() {
  console.log('Function starting...');
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);
    
    // Create a test user with a known password for testing
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: { 
        password: hashedPassword,
        name: 'Test User' 
      },
      create: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'MEMBER'
      }
    });
    
    console.log('Test user created or updated:', testUser.email);
    console.log('You can now try logging in with:');
    console.log('Email: test@example.com');
    console.log('Password: testpassword123');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

checkUsers().catch(console.error);
