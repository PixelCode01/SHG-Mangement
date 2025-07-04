/**
 * This script tests the complete registration flow including all API endpoints
 * to ensure they're working as expected.
 * 
 * Run this script after making changes to the registration flow to verify everything works.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

// Set this to your local development URL
const API_BASE_URL = 'http://localhost:3000/api';

// Helper function to generate random test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `test-user-${timestamp}@example.com`,
    password: `Password123!${timestamp.toString().slice(-4)}`,
    role: Math.random() > 0.5 ? 'MEMBER' : 'GROUP_LEADER'
  };
}

// Helper function to create a test member
async function createTestMember() {
  try {
    const member = await prisma.member.create({
      data: {
        name: `Test Member ${Date.now()}`,
        phone: `123-${Date.now().toString().slice(-7)}`,
        address: 'Test Address'
      }
    });
    console.log('Created test member with ID:', member.id);
    return member;
  } catch (error) {
    console.error('Error creating test member:', error);
    throw error;
  }
}

// Test the member ID validation endpoint
async function testMemberIdValidation(memberId) {
  try {
    console.log('\n🔍 Testing Member ID validation endpoint...');
    const response = await fetch(`${API_BASE_URL}/auth/check-member-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    return { success: response.ok, result };
  } catch (error) {
    console.error('Error testing member ID validation:', error);
    return { success: false, error: error.message };
  }
}

// Test the registration endpoint
async function testRegistration(userData) {
  try {
    console.log('\n📝 Testing registration endpoint...');
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    return { success: response.status === 201, result };
  } catch (error) {
    console.error('Error testing registration:', error);
    return { success: false, error: error.message };
  }
}

// Test various invalid scenarios
async function testInvalidScenarios() {
  console.log('\n❌ Testing invalid registration scenarios...');
  
  // Test registering with invalid email
  const invalidEmailData = generateTestData();
  invalidEmailData.email = 'not-an-email';
  
  const invalidEmailResult = await testRegistration(invalidEmailData);
  console.log('Invalid email test result:', invalidEmailResult.success ? 'FAILED (should reject)' : 'PASSED (rejected as expected)');
  
  // Test registering with weak password
  const weakPasswordData = generateTestData();
  weakPasswordData.password = 'weak';
  
  const weakPasswordResult = await testRegistration(weakPasswordData);
  console.log('Weak password test result:', weakPasswordResult.success ? 'FAILED (should reject)' : 'PASSED (rejected as expected)');
  
  // Test Member role without member ID
  const noMemberIdData = generateTestData();
  noMemberIdData.role = 'MEMBER';
  delete noMemberIdData.memberId;
  
  const noMemberIdResult = await testRegistration(noMemberIdData);
  console.log('Missing member ID test result:', noMemberIdResult.success ? 'FAILED (should reject)' : 'PASSED (rejected as expected)');
}

// Main test function
async function runTests() {
  try {
    console.log('🧪 Starting registration flow verification tests...');
    
    // Create a test member to use
    const testMember = await createTestMember();
    
    // 1. Test member ID validation
    const validationResult = await testMemberIdValidation(testMember.id);
    if (!validationResult.success) {
      console.error('❌ Member ID validation failed!');
    } else {
      console.log('✅ Member ID validation successful!');
    }
    
    // 2. Test Group Leader registration (doesn't need member ID)
    const leaderData = generateTestData();
    leaderData.role = 'GROUP_LEADER';
    
    const leaderResult = await testRegistration(leaderData);
    if (!leaderResult.success) {
      console.error('❌ Group Leader registration failed!');
    } else {
      console.log('✅ Group Leader registration successful!');
    }
    
    // 3. Test Member registration with member ID
    const memberData = generateTestData();
    memberData.role = 'MEMBER';
    memberData.memberId = testMember.id;
    
    const memberResult = await testRegistration(memberData);
    if (!memberResult.success) {
      console.error('❌ Member registration failed!');
    } else {
      console.log('✅ Member registration successful!');
    }
    
    // 4. Test invalid scenarios
    await testInvalidScenarios();
    
    console.log('\n🏁 Test Summary:');
    console.log('- Member ID validation:', validationResult.success ? 'PASSED ✅' : 'FAILED ❌');
    console.log('- Group Leader registration:', leaderResult.success ? 'PASSED ✅' : 'FAILED ❌');
    console.log('- Member registration:', memberResult.success ? 'PASSED ✅' : 'FAILED ❌');
    
    // Clean up test data
    if (testMember) {
      await prisma.member.delete({ where: { id: testMember.id } });
      console.log('\n🧹 Cleaned up test member data');
    }
    
    if (leaderResult.success && leaderResult.result.user) {
      await prisma.user.delete({ where: { id: leaderResult.result.user.id } });
      console.log('🧹 Cleaned up test leader user data');
    }
    
    if (memberResult.success && memberResult.result.user) {
      await prisma.user.delete({ where: { id: memberResult.result.user.id } });
      console.log('🧹 Cleaned up test member user data');
    }
    
  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
runTests()
  .then(() => console.log('\n✨ All tests completed!'))
  .catch((err) => console.error('\n💥 Test script failed:', err));
