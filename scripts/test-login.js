// Test script for testing login with a specific user
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcrypt');
require('dotenv').config();

// Initialize Prisma client
const prisma = new PrismaClient();

async function main() {
  // Get test credentials from command line arguments
  const testEmail = process.argv[2] || 'admin@example.com';
  const testPassword = process.argv[3] || 'password';

  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
  
  try {
    console.log(`\n== Testing Authentication for ${testEmail} ==`);
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected, searching for user...');
    
    const user = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    
    if (!user) {
      console.log(`❌ User with email ${testEmail} not found`);
      return;
    } 
    
    if (!user.password) {
      console.log(`❌ User found but has no password set`);
      return;
    }
    
    console.log('✅ User found');
    console.log(`User details: Name=${user.name}, Role=${user.role}`);
    
    // Try password match
    const passwordMatch = await compare(testPassword, user.password);
    console.log(`Password check: ${passwordMatch ? '✅ Password matches' : '❌ Password does not match'}`);
    
    if (passwordMatch) {
      console.log('\nAuthentication successful! The user should be able to log in.');
      console.log('If login is still failing, check for cookie or session issues:');
      console.log('- Try clearing browser cookies for localhost');
      console.log('- Check if cookies are being properly set by the NextAuth library');
      console.log('- Ensure the redirect after login is working properly');
    } else {
      console.log('\nAuthentication failed due to incorrect password.');
      console.log('Please try with the correct password for this user.');
    }
    
  } catch (error) {
    console.error('Error during authentication test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv.length < 3) {
  console.log('Usage: node test-login.js <email> <password>');
  console.log('Example: node test-login.js admin@example.com password123');
  console.log('\nUsing default credentials for testing...');
}

main()
  .catch(e => {
    console.error('Script error:', e);
    process.exit(1);
  });
