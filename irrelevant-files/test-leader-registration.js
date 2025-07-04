/**
 * Test script to verify that GROUP_LEADER registration does not create member records
 * and MEMBER registration still works correctly
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLeaderRegistration() {
  console.log('🧪 Testing GROUP_LEADER registration (should NOT create member record)...');
  
  try {
    // Test data for a GROUP_LEADER
    const leaderData = {
      name: 'Test Leader',
      email: 'testleader@example.com',
      password: 'testpassword123',
      role: 'GROUP_LEADER' // Fixed: use 'role' not 'userRole'
    };

    console.log('Sending registration data:', leaderData);

    // Make API call to register endpoint
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leaderData),
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ GROUP_LEADER registration successful');
      console.log('User created:', {
        id: result.user?.id,
        name: result.user?.name,
        email: result.user?.email,
        role: result.user?.role,
        memberId: result.user?.memberId
      });
      
      // Verify no member record was created with the leader's name
      const memberWithLeaderName = await prisma.member.findFirst({
        where: { name: leaderData.name }
      });
      
      if (memberWithLeaderName) {
        console.log('❌ ERROR: Member record was created for GROUP_LEADER!');
        console.log('Member record:', memberWithLeaderName);
      } else {
        console.log('✅ SUCCESS: No member record created for GROUP_LEADER');
      }
      
      // Clean up - delete the test user
      await prisma.user.delete({
        where: { id: result.user.id }
      });
      console.log('🧹 Test user cleaned up');
      
    } else {
      console.log('❌ GROUP_LEADER registration failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

async function testMemberRegistration() {
  console.log('\n🧪 Testing MEMBER registration (should work with memberId)...');
  
  try {
    // First create a test member to link to
    const testMember = await prisma.member.create({
      data: {
        name: 'Test Member for Registration',
        email: 'testmember@example.com',
        // Add minimum required fields
      }
    });
    
    console.log('Created test member:', testMember.id);
    
    // Test data for a MEMBER
    const memberData = {
      name: 'Test Member User',
      email: 'testmember@example.com',
      password: 'testpassword123',
      role: 'MEMBER', // Fixed: use 'role' not 'userRole'
      memberId: testMember.id
    };

    // Make API call to register endpoint
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(memberData),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ MEMBER registration successful');
      console.log('User created:', {
        id: result.user?.id,
        name: result.user?.name,
        email: result.user?.email,
        role: result.user?.role,
        memberId: result.user?.memberId
      });
      
      if (result.user?.memberId === testMember.id) {
        console.log('✅ SUCCESS: Member correctly linked to existing member record');
      } else {
        console.log('❌ ERROR: Member not properly linked to member record');
      }
      
      // Clean up - delete the test user and member
      await prisma.user.delete({
        where: { id: result.user.id }
      });
      console.log('🧹 Test user cleaned up');
      
    } else {
      console.log('❌ MEMBER registration failed:', result);
    }
    
    // Clean up the test member
    await prisma.member.delete({
      where: { id: testMember.id }
    });
    console.log('🧹 Test member cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting registration tests...\n');
  
  await testLeaderRegistration();
  await testMemberRegistration();
  
  console.log('\n✨ Tests completed!');
  await prisma.$disconnect();
}

runTests().catch(console.error);
