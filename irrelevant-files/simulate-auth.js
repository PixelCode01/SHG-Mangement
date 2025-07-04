const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Simulate the exact authentication flow from auth-config.ts
async function simulateAuth() {
  try {
    console.log('🔍 Simulating NextAuth authentication flow...\n');
    
    const credentials = {
      identifier: 'admin@test.com',
      password: 'password123'
    };
    
    console.log(`1. Starting auth with identifier: ${credentials.identifier}`);
    
    if (!credentials.identifier || !credentials.password) {
      console.log('❌ Missing identifier or password');
      return;
    }
    
    const identifier = credentials.identifier;
    const password = credentials.password;
    
    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@');
    const isPhone = /^\+?[\d\s\-\(\)]+$/.test(identifier);
    
    console.log(`2. Identifier type - Email: ${isEmail}, Phone: ${isPhone}`);
    
    let userFromDb = null;
    
    if (isEmail) {
      console.log(`3. Searching for user with email: ${identifier}`);
      userFromDb = await prisma.user.findFirst({
        where: {
          email: identifier,
        },
      });
    } else if (isPhone) {
      const normalizedPhone = identifier.replace(/[\s\-\(\)]/g, '');
      console.log(`3. Searching for user with phone: ${normalizedPhone}`);
      userFromDb = await prisma.user.findFirst({
        where: {
          phone: normalizedPhone,
        },
      });
    } else {
      console.log('❌ Identifier is neither email nor phone format');
      return;
    }
    
    if (!userFromDb) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log(`4. User found: ${userFromDb.email || userFromDb.phone}`);
    console.log(`   Has password: ${!!userFromDb.password}`);
    
    if (!userFromDb.password) {
      console.log('❌ User has no password set');
      return;
    }
    
    console.log('5. Comparing passwords...');
    const passwordMatch = await bcrypt.compare(password, userFromDb.password);
    
    if (!passwordMatch) {
      console.log('❌ Password does not match');
      return;
    }
    
    console.log('✅ Authentication successful!');
    console.log('6. Returning user object:', {
      id: userFromDb.id,
      name: userFromDb.name,
      email: userFromDb.email,
      role: userFromDb.role,
      memberId: userFromDb.memberId,
    });
    
  } catch (error) {
    console.error('❌ Error during authentication simulation:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

simulateAuth();
