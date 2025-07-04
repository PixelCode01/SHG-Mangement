const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function debugLoginIssue() {
  try {
    console.log('🔍 Debugging login issue...\n');
    
    // 1. Test database connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');
    
    // 2. Check if any users exist
    console.log('2. Checking existing users...');
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
    
    console.log(`Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}`);
      console.log(`     Email: ${user.email || 'N/A'}`);
      console.log(`     Phone: ${user.phone || 'N/A'}`);
      console.log(`     Name: ${user.name || 'N/A'}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Has Password: ${!!user.password}`);
      console.log();
    });
    
    // 3. If no users exist, create a test user
    if (users.length === 0) {
      console.log('3. No users found. Creating test user...');
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      const testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          phone: '+1234567890',
          name: 'Test User',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      
      console.log('✅ Test user created:');
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Phone: ${testUser.phone}`);
      console.log(`   Password: password123`);
      console.log(`   Role: ${testUser.role}\n`);
    }
    
    // 4. Test password comparison for existing users
    console.log('4. Testing password verification...');
    const testEmail = 'test@example.com';
    const testPassword = 'password123';
    
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: testEmail },
          { phone: '+1234567890' }
        ]
      }
    });
    
    if (user && user.password) {
      console.log('Testing password comparison...');
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log(`Password validation result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      // Test with wrong password
      const wrongPasswordTest = await bcrypt.compare('wrongpassword', user.password);
      console.log(`Wrong password test: ${wrongPasswordTest ? '❌ UNEXPECTED SUCCESS' : '✅ CORRECTLY REJECTED'}`);
    } else {
      console.log('❌ No user found for testing or user has no password');
    }
    
    console.log('\n5. Environment check...');
    console.log(`NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || '❌ Missing'}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLoginIssue();
