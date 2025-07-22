#!/usr/bin/env node

/**
 * Test script to verify that the period display fix works
 * This tests the complete flow from group creation form to contribution tracking display
 */

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function testPeriodDisplayFix() {
  console.log('🧪 Testing Period Display Fix - Start from Next Period\n');

  try {
    // Find any existing group for testing 
    const testGroup = await prisma.group.findFirst({
      include: {
        leader: true
      }
    });

    if (!testGroup) {
      console.log('❌ No test group found. Please create a group using the form first.');
      return;
    }

    console.log(`🔍 Testing with group: ${testGroup.name} (ID: ${testGroup.id})`);
    console.log(`   Group's configured period: ${testGroup.currentPeriodMonth}/${testGroup.currentPeriodYear}`);

    // Test 1: Check current period API response
    console.log('\n1. 📋 Testing Current Period API...');
    const periodResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/periods/current`);
    
    if (periodResponse.ok) {
      const periodData = await periodResponse.json();
      console.log('✅ Current Period API Response:', {
        success: periodData.success,
        periodId: periodData.period?.id,
        startDate: periodData.period?.startDate,
        periodNumber: periodData.period?.periodNumber,
        isClosed: periodData.period?.isClosed
      });

      if (periodData.period?.startDate) {
        const periodDate = new Date(periodData.period.startDate);
        const displayMonth = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        console.log(`📅 Period Display Name: "${displayMonth}"`);

        // Check if this matches the expected month
        const expectedMonth = testGroup.currentPeriodMonth;
        const expectedYear = testGroup.currentPeriodYear;
        const actualMonth = periodDate.getMonth() + 1; // Convert from 0-based
        const actualYear = periodDate.getFullYear();

        if (expectedMonth && expectedYear) {
          if (actualMonth === expectedMonth && actualYear === expectedYear) {
            console.log('✅ SUCCESS: Period display matches group configuration!');
            console.log(`   Expected: ${expectedMonth}/${expectedYear}`);
            console.log(`   Actual: ${actualMonth}/${actualYear}`);
          } else {
            console.log('❌ FAILURE: Period display does not match group configuration!');
            console.log(`   Expected: ${expectedMonth}/${expectedYear}`);
            console.log(`   Actual: ${actualMonth}/${actualYear}`);
          }
        } else {
          console.log('⚠️ Group has no configured period - this may be a legacy group');
        }
      }
    } else {
      console.log('❌ Current Period API failed:', periodResponse.status, await periodResponse.text());
    }

    // Test 2: Test the frontend page directly  
    console.log('\n2. 🌐 Manual Testing Instructions:');
    console.log(`   Navigate to: http://localhost:3000/groups/${testGroup.id}/contributions`);
    console.log(`   Check that the period name shows the correct month`);
    if (testGroup.currentPeriodMonth && testGroup.currentPeriodYear) {
      const expectedDate = new Date(testGroup.currentPeriodYear, testGroup.currentPeriodMonth - 1, 10);
      const expectedDisplay = expectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   Expected display: "${expectedDisplay}"`);
    }

    console.log('\n✅ Test completed! Check the results above.');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted...');
  await prisma.$disconnect();
  process.exit(0);
});

testPeriodDisplayFix();
