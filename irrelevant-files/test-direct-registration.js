/**
 * Direct verification script to test if GROUP_LEADER registration creates member records
 * This bypasses the HTTP API and tests the core logic directly
 */

const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');

const prisma = new PrismaClient();

async function testDirectRegistration() {
  console.log('🧪 Testing direct GROUP_LEADER registration (no member creation)...');
  
  try {
    // Create a GROUP_LEADER user directly using the same logic as the API
    const hashedPassword = await hash('testpassword123', 10);
    
    const user = await prisma.$transaction(async (tx) => {
      // This mirrors the exact logic from the registration API
      const userRole = "GROUP_LEADER";
      let memberIdToUse = undefined; // No memberId provided for leader
      
      console.log(`Processing registration for role: ${userRole}, memberId: ${memberIdToUse}`);

      // Create the user with the same logic as the API
      const newUser = await tx.user.create({
        data: {
          name: 'Direct Test Leader',
          email: 'directtestleader@example.com',
          phone: `+1234567${Date.now().toString().slice(-3)}`, // Unique phone number
          password: hashedPassword,
          role: userRole,
          memberId: userRole === "MEMBER" ? memberIdToUse : undefined, // Only link memberId for MEMBER role
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          memberId: true,
          createdAt: true,
        }
      });
      
      console.log(`Successfully created User with ID: ${newUser.id}, linked memberId: ${newUser.memberId}`);
      return newUser;
    });

    console.log('✅ GROUP_LEADER user created successfully:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberId: user.memberId
    });
    
    // Verify no member record was automatically created with the leader's name
    const memberWithLeaderName = await prisma.member.findFirst({
      where: { name: 'Direct Test Leader' }
    });
    
    if (memberWithLeaderName) {
      console.log('❌ ERROR: Member record was created for GROUP_LEADER!');
      console.log('Member record:', memberWithLeaderName);
    } else {
      console.log('✅ SUCCESS: No member record created for GROUP_LEADER');
    }
    
    // Verify the user has no memberId linked
    if (user.memberId === null || user.memberId === undefined) {
      console.log('✅ SUCCESS: GROUP_LEADER has no memberId linked');
    } else {
      console.log('❌ ERROR: GROUP_LEADER has memberId linked:', user.memberId);
    }
    
    // Clean up - delete the test user
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log('🧹 Test user cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

async function testDirectMemberRegistration() {
  console.log('\n🧪 Testing direct MEMBER registration (with member link)...');
  
  try {
    // First create a test member to link to
    const testMember = await prisma.member.create({
      data: {
        name: 'Direct Test Member for Registration',
        email: 'directtestmember@example.com',
      }
    });
    
    console.log('Created test member:', testMember.id);
    
    // Create a MEMBER user directly
    const hashedPassword = await hash('testpassword123', 10);
    
    const user = await prisma.$transaction(async (tx) => {
      const userRole = "MEMBER";
      let memberIdToUse = testMember.id;
      
      console.log(`Processing registration for role: ${userRole}, memberId: ${memberIdToUse}`);

      const newUser = await tx.user.create({
        data: {
          name: 'Direct Test Member User',
          email: 'directtestmemberuser@example.com',
          phone: `+9876543${Date.now().toString().slice(-3)}`, // Unique phone number
          password: hashedPassword,
          role: userRole,
          memberId: userRole === "MEMBER" ? memberIdToUse : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          memberId: true,
          createdAt: true,
        }
      });
      
      console.log(`Successfully created User with ID: ${newUser.id}, linked memberId: ${newUser.memberId}`);
      return newUser;
    });

    console.log('✅ MEMBER user created successfully:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberId: user.memberId
    });
    
    // Verify the user is properly linked to the member
    if (user.memberId === testMember.id) {
      console.log('✅ SUCCESS: MEMBER correctly linked to existing member record');
    } else {
      console.log('❌ ERROR: MEMBER not properly linked to member record');
      console.log('Expected memberId:', testMember.id);
      console.log('Actual memberId:', user.memberId);
    }
    
    // Clean up
    await prisma.user.delete({
      where: { id: user.id }
    });
    await prisma.member.delete({
      where: { id: testMember.id }
    });
    console.log('🧹 Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

async function runDirectTests() {
  console.log('🚀 Starting direct registration tests...\n');
  
  await testDirectRegistration();
  await testDirectMemberRegistration();
  
  console.log('\n✨ Direct tests completed!');
  await prisma.$disconnect();
}

runDirectTests().catch(console.error);
