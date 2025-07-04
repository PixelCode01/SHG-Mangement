#!/usr/bin/env node

/**
 * Clean up stale sessions and accounts that reference non-existent users
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupStaleData() {
  console.log('🧹 Cleaning up stale authentication data...\n');

  try {
    // Get all user IDs that actually exist
    const existingUsers = await prisma.user.findMany({
      select: { id: true }
    });
    
    const existingUserIds = existingUsers.map(u => u.id);
    console.log(`✅ Found ${existingUserIds.length} valid users`);

    // Find and delete sessions for non-existent users
    const staleSessions = await prisma.session.findMany({
      where: {
        userId: {
          notIn: existingUserIds
        }
      }
    });

    if (staleSessions.length > 0) {
      console.log(`🗑️  Found ${staleSessions.length} stale sessions`);
      
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          userId: {
            notIn: existingUserIds
          }
        }
      });
      
      console.log(`✅ Deleted ${deletedSessions.count} stale sessions`);
    } else {
      console.log('✅ No stale sessions found');
    }

    // Find and delete accounts for non-existent users
    const staleAccounts = await prisma.account.findMany({
      where: {
        userId: {
          notIn: existingUserIds
        }
      }
    });

    if (staleAccounts.length > 0) {
      console.log(`🗑️  Found ${staleAccounts.length} stale accounts`);
      
      const deletedAccounts = await prisma.account.deleteMany({
        where: {
          userId: {
            notIn: existingUserIds
          }
        }
      });
      
      console.log(`✅ Deleted ${deletedAccounts.count} stale accounts`);
    } else {
      console.log('✅ No stale accounts found');
    }

    // Check for any password reset tokens for non-existent users
    const staleTokens = await prisma.passwordResetToken.findMany({
      where: {
        userId: {
          notIn: existingUserIds
        }
      }
    });

    if (staleTokens.length > 0) {
      console.log(`🗑️  Found ${staleTokens.length} stale password reset tokens`);
      
      const deletedTokens = await prisma.passwordResetToken.deleteMany({
        where: {
          userId: {
            notIn: existingUserIds
          }
        }
      });
      
      console.log(`✅ Deleted ${deletedTokens.count} stale password reset tokens`);
    } else {
      console.log('✅ No stale password reset tokens found');
    }

    console.log('\n🎉 Authentication data cleanup completed successfully!');
    console.log('💡 If you\'re still experiencing "User not found" errors, try logging out and logging back in.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupStaleData();
