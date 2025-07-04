/**
 * Test script for registration process
 * 
 * This script helps verify that the registration process works correctly,
 * especially with member ID validation.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

// Helper function to create a test member
async function createTestMember() {
  try {
    const member = await prisma.member.create({
      data: {
        name: 'Test Member',
        phone: '1234567890',
        address: 'Test Address',
      }
    });
    console.log('Created test member with ID:', member.id);
    return member;
  } catch (error) {
    console.error('Error creating test member:', error);
    throw error;
  }
}

// Helper function to cleanup test data
async function cleanupTestData(email, memberId) {
  try {
    // Delete any user created with test email
    if (email) {
      await prisma.user.deleteMany({
        where: { email },
      });
      console.log('Cleaned up test user with email:', email);
    }
    
    // Delete test member if provided
    if (memberId) {
      await prisma.member.delete({
        where: { id: memberId },
      });
      console.log('Cleaned up test member with ID:', memberId);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Helper function to try registering a user
async function simulateRegistration(userData) {
  const { name, email, password, role, memberId } = userData;
  
  console.log(`Simulating registration for: ${email} with role ${role}`);
  
  // Validation checks similar to those in the API route
  if (!name || !email || !password) {
    console.error('Missing required fields');
    return false;
  }
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  
  if (existingUser) {
    console.error('User already exists with email:', email);
    return false;
  }
  
  // If member ID is provided, check if it exists
  if (memberId) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });
    
    if (!member) {
      console.error('Invalid Member ID:', memberId);
      return false;
    }
    
    // Check if this member is already linked to another user
    const existingUserWithMemberId = await prisma.user.findFirst({
      where: { memberId },
    });
    
    if (existingUserWithMemberId) {
      console.error('This Member ID is already linked to another user account');
      return false;
    }
  }
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create user
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        memberId: role === 'MEMBER' ? memberId : undefined,
      },
    });
    
    console.log('Successfully created test user:', user.id);
    return true;
  } catch (error) {
    console.error('Error creating user:', error);
    return false;
  }
}

// Main test function
async function runTests() {
  let testMemberId = null;
  const testEmail = `test-user-${Date.now()}@example.com`;
  
  try {
    console.log('Starting registration tests...');
    
    // Create a test member to use for registration
    const member = await createTestMember();
    testMemberId = member.id;
    
    // Test 1: Valid GROUP_LEADER registration (no member ID needed)
    console.log('\nTest 1: Valid GROUP_LEADER registration');
    const leaderResult = await simulateRegistration({
      name: 'Test Leader',
      email: `leader-${testEmail}`,
      password: 'Password123!',
      role: 'GROUP_LEADER',
    });
    console.log('GROUP_LEADER registration result:', leaderResult ? 'SUCCESS' : 'FAILED');
    
    // Test 2: Valid MEMBER registration with member ID
    console.log('\nTest 2: Valid MEMBER registration with member ID');
    const memberResult = await simulateRegistration({
      name: 'Test Member User',
      email: testEmail,
      password: 'Password123!',
      role: 'MEMBER',
      memberId: testMemberId,
    });
    console.log('MEMBER registration result:', memberResult ? 'SUCCESS' : 'FAILED');
    
    // Test 3: MEMBER registration with invalid member ID
    console.log('\nTest 3: MEMBER registration with invalid member ID');
    const invalidMemberResult = await simulateRegistration({
      name: 'Invalid Member',
      email: `invalid-${testEmail}`,
      password: 'Password123!',
      role: 'MEMBER',
      memberId: 'invalid-id',
    });
    console.log('Invalid MEMBER registration result:', !invalidMemberResult ? 'SUCCESS (rejected as expected)' : 'FAILED (should have been rejected)');
    
    // Test 4: MEMBER registration with already linked member ID
    console.log('\nTest 4: MEMBER registration with already linked member ID');
    const duplicateMemberResult = await simulateRegistration({
      name: 'Duplicate Member',
      email: `duplicate-${testEmail}`,
      password: 'Password123!',
      role: 'MEMBER',
      memberId: testMemberId,  // Same as Test 2
    });
    console.log('Duplicate MEMBER registration result:', !duplicateMemberResult ? 'SUCCESS (rejected as expected)' : 'FAILED (should have been rejected)');
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error during tests:', error);
  } finally {
    // Clean up test data
    await cleanupTestData(testEmail, testMemberId);
    await cleanupTestData(`leader-${testEmail}`);
    await cleanupTestData(`invalid-${testEmail}`);
    await cleanupTestData(`duplicate-${testEmail}`);
    
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the tests
runTests()
  .then(() => console.log('Test script completed'))
  .catch(err => console.error('Test script failed:', err));
