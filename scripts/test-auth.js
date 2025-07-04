// Test script for diagnosing authentication issues
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcrypt');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Prisma client
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== AUTHENTICATION DIAGNOSTIC TOOL ===\n');
  
  // 1. Check environment variables
  console.log('== Checking Environment Variables ==');
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  const dbUrl = process.env.DATABASE_URL;
  
  console.log(`NEXTAUTH_URL: ${nextAuthUrl ? '✅ Set' : '❌ Not set'} (${nextAuthUrl || 'undefined'})`);
  console.log(`NEXTAUTH_SECRET: ${nextAuthSecret ? '✅ Set' : '❌ Not set'} (${nextAuthSecret ? '[SECRET]' : 'undefined'})`);
  console.log(`DATABASE_URL: ${dbUrl ? '✅ Set' : '❌ Not set'} (${dbUrl ? '[CONNECTION STRING]' : 'undefined'})`);
  
  // 2. Test database connection
  console.log('\n== Testing Database Connection ==');
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Count users to verify DB access
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);
    
    // List all users (helps for login testing)
    console.log('\n== Available Users ==');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    
    users.forEach(user => {
      console.log(`- ${user.name || 'Unnamed'} (${user.email || 'No email'}) - Role: ${user.role}`);
    });
    
    // 3. Test authentication with specified credentials (optional)
    if (process.argv.length > 3) {
      const testEmail = process.argv[2];
      const testPassword = process.argv[3];
      
      console.log(`\n== Testing Authentication for ${testEmail} ==`);
      const user = await prisma.user.findUnique({
        where: { email: testEmail }
      });
      
      if (!user) {
        console.log(`❌ User with email ${testEmail} not found`);
      } else if (!user.password) {
        console.log(`❌ User found but has no password set`);
      } else {
        const passwordMatch = await compare(testPassword, user.password);
        console.log(`Password check: ${passwordMatch ? '✅ Password matches' : '❌ Password does not match'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
  
  // 4. Check nextauth-related files
  console.log('\n== Checking NextAuth Configuration ==');
  const authPath = path.join(process.cwd(), 'app', 'api', 'auth', '[...nextauth]', 'route.ts');
  const middlewarePath = path.join(process.cwd(), 'middleware.ts');
  
  if (fs.existsSync(authPath)) {
    console.log('✅ NextAuth route file exists');
  } else {
    console.log('❌ NextAuth route file not found');
  }
  
  if (fs.existsSync(middlewarePath)) {
    console.log('✅ Middleware file exists');
  } else {
    console.log('❌ Middleware file not found');
  }
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

main()
  .catch(e => {
    console.error('Diagnostic script error:', e);
    process.exit(1);
  });
