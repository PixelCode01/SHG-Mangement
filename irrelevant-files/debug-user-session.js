#!/usr/bin/env node

/**
 * Debug script to check user and session integrity
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugUserSession() {
  console.log('🔍 Debugging User Session Issues...\n');

  try {
    // Check all users in the database
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        memberId: true,
        createdAt: true
      }
    });

    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    if (allUsers.length === 0) {
      console.log('❌ No users found in database!');
      return;
    }

    console.log('\n👤 Users in database:');
    allUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}`);
      console.log(`     Name: ${user.name || 'null'}`);
      console.log(`     Email: ${user.email || 'null'}`);
      console.log(`     Phone: ${user.phone || 'null'}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Member ID: ${user.memberId || 'null'}`);
      console.log(`     Created: ${user.createdAt}`);
      console.log('');
    });

    // Check if there are orphaned sessions (if you have a sessions table)
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        userId: true,
        expires: true
      }
    });

    console.log(`🔗 Total sessions: ${sessions.length}`);
    
    if (sessions.length > 0) {
      console.log('\n🔗 Active sessions:');
      for (const session of sessions) {
        console.log(`  Session ID: ${session.id}`);
        console.log(`  User ID: ${session.userId}`);
        console.log(`  Expires: ${session.expires}`);
        
        // Check if the user exists
        const userExists = allUsers.find(u => u.id === session.userId);
        if (userExists) {
          console.log(`  ✅ User exists: ${userExists.name || userExists.email || 'Unknown'}`);
        } else {
          console.log(`  ❌ User NOT found for session!`);
        }
        console.log('');
      }
    }

    // Check the specific user ID from the error log
    const problemUserId = "68397df36d3f6fe5efc65db3";
    console.log(`\n🎯 Checking specific user ID from error: ${problemUserId}`);
    
    const specificUser = await prisma.user.findUnique({
      where: { id: problemUserId },
      include: { member: true }
    });

    if (specificUser) {
      console.log('✅ User found:');
      console.log(`  Name: ${specificUser.name}`);
      console.log(`  Email: ${specificUser.email}`);
      console.log(`  Role: ${specificUser.role}`);
      console.log(`  Member linked: ${specificUser.member ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ User NOT found in database');
      console.log('💡 This explains the "User not found" errors');
    }

    // Check if any accounts are linked to non-existent users
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        type: true
      }
    });

    console.log(`\n🔐 Total accounts: ${accounts.length}`);
    if (accounts.length > 0) {
      console.log('\n🔐 OAuth accounts:');
      for (const account of accounts) {
        const userExists = allUsers.find(u => u.id === account.userId);
        console.log(`  Account ID: ${account.id}`);
        console.log(`  Provider: ${account.provider} (${account.type})`);
        console.log(`  User ID: ${account.userId}`);
        console.log(`  User exists: ${userExists ? '✅' : '❌'}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugUserSession();
