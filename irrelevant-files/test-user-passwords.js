const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testExistingUsers() {
  try {
    console.log('🔍 Testing existing users for login...\n');
    
    // Get all users with their passwords
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        password: true
      }
    });
    
    console.log(`Found ${users.length} users. Testing common passwords...\n`);
    
    const commonPasswords = ['password', 'password123', '123456', 'admin', 'test'];
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`Testing user ${i + 1}: ${user.email}`);
      
      if (!user.password) {
        console.log('  ❌ No password set for this user\n');
        continue;
      }
      
      let foundPassword = false;
      for (const testPassword of commonPasswords) {
        try {
          const isValid = await bcrypt.compare(testPassword, user.password);
          if (isValid) {
            console.log(`  ✅ Password found: "${testPassword}"`);
            foundPassword = true;
            break;
          }
        } catch (error) {
          console.log(`  ❌ Error testing password "${testPassword}":`, error.message);
        }
      }
      
      if (!foundPassword) {
        console.log('  ❌ None of the common passwords worked');
      }
      console.log();
    }
    
    // Create a known test user
    console.log('Creating a new test user with known credentials...');
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    try {
      const testUser = await prisma.user.create({
        data: {
          email: 'admin@test.com',
          phone: '+1234567890',
          name: 'Admin Test User',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      
      console.log('✅ Test user created successfully:');
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Phone: ${testUser.phone}`);
      console.log(`   Password: password123`);
      console.log(`   Role: ${testUser.role}`);
      
      // Test the new user immediately
      console.log('\n🧪 Testing new user credentials...');
      const testResult = await bcrypt.compare('password123', testUser.password);
      console.log(`Password verification: ${testResult ? '✅ SUCCESS' : '❌ FAILED'}`);
      
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('ℹ️  Test user already exists with this email');
      } else {
        console.error('❌ Error creating test user:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testExistingUsers();
