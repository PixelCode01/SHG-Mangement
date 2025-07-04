#!/usr/bin/env node
// HTTP test to verify the actual API endpoint works

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testActualAPIEndpoint() {
  console.log('🧪 Testing actual HTTP API endpoint /api/pending-leaderships...');
  
  let testUser = null;
  
  try {
    // Create a GROUP_LEADER user without member profile
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    testUser = await prisma.user.create({
      data: {
        name: 'HTTP Test Leader',
        email: 'httptestleader@example.com',
        password: hashedPassword,
        role: 'GROUP_LEADER',
        memberId: null,
      }
    });
    
    console.log('✅ Created test GROUP_LEADER user:', testUser.id);

    // First login to get session cookie
    console.log('🔐 Logging in to get session...');
    
    const loginResponse = await fetch('http://localhost:3000/api/auth/signin/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        identifier: 'httptestleader@example.com',
        password: 'testpassword123',
        redirect: 'false'
      })
    });

    console.log('Login response status:', loginResponse.status);
    
    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.log('Login response:', loginError);
      throw new Error('Failed to login');
    }

    // Extract session cookie
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    let sessionCookie = '';
    
    if (setCookieHeader) {
      // Extract the session cookie (next-auth.session-token)
      const cookies = setCookieHeader.split(',');
      for (const cookie of cookies) {
        if (cookie.includes('next-auth.session-token')) {
          sessionCookie = cookie.split(';')[0].trim();
          break;
        }
      }
    }
    
    console.log('Session cookie found:', sessionCookie ? 'Yes' : 'No');
    
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }

    // Now test the pending leaderships API
    console.log('📡 Testing /api/pending-leaderships endpoint...');
    
    const apiResponse = await fetch('http://localhost:3000/api/pending-leaderships', {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    });

    console.log('API response status:', apiResponse.status);
    
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log('✅ SUCCESS: API returned data:', data);
      console.log('✅ SUCCESS: PendingLeadershipInvitations component should work without errors');
    } else {
      const errorData = await apiResponse.text();
      console.log('❌ API Error:', errorData);
      throw new Error('API call failed');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  } finally {
    // Clean up test user
    if (testUser) {
      try {
        await prisma.user.delete({
          where: { id: testUser.id }
        });
        console.log('🧹 Test user cleaned up');
      } catch (cleanupError) {
        console.error('⚠️ Error cleaning up test user:', cleanupError);
      }
    }
    
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    await testActualAPIEndpoint();
    console.log('\n✨ HTTP API test completed successfully!');
  } catch (error) {
    console.error('❌ HTTP API test failed:', error);
    process.exit(1);
  }
}

main();
