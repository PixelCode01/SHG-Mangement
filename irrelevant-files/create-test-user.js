#!/usr/bin/env node

/**
 * Create a test admin user to fix authentication issues
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser() {
  console.log('👤 Creating test admin user...\n');

  try {
    // Check if any users exist
    const existingUsers = await prisma.user.count();
    
    if (existingUsers > 0) {
      console.log(`✅ Found ${existingUsers} existing users. No need to create test user.`);
      return;
    }

    // Hash a simple password
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create a test admin user
    const testUser = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: 'admin@test.com',
        phone: '+1234567890',
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: new Date(),
        phoneVerified: new Date()
      }
    });

    console.log('✅ Test admin user created successfully!');
    console.log(`   ID: ${testUser.id}`);
    console.log(`   Name: ${testUser.name}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Role: ${testUser.role}`);
    console.log('');
    console.log('📝 Login credentials:');
    console.log('   Email: admin@test.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('🎯 This should resolve the "User not found" errors.');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    
    if (error.code === 'P2002') {
      console.log('💡 User with this email or phone already exists');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the creation
createTestUser();
