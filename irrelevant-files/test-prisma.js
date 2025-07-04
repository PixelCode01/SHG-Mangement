const { PrismaClient } = require('@prisma/client');

// Test file to check Prisma client generation
const prisma = new PrismaClient();

async function testPrismaClient() {
  try {
    // Test if the new models are available
    console.log('Available models:', Object.keys(prisma));
    
    // Check if memberContribution exists
    if ('memberContribution' in prisma) {
      console.log('memberContribution model is available');
    } else {
      console.log('memberContribution model is NOT available');
    }
    
    // Check if cashAllocation exists
    if ('cashAllocation' in prisma) {
      console.log('cashAllocation model is available');
    } else {
      console.log('cashAllocation model is NOT available');
    }
    
    // Check if lateFineRule exists
    if ('lateFineRule' in prisma) {
      console.log('lateFineRule model is available');
    } else {
      console.log('lateFineRule model is NOT available');
    }
  } catch (error) {
    console.error('Error testing Prisma client:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaClient();
