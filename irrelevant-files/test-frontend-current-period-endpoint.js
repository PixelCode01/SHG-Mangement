#!/usr/bin/env node

/**
 * Test the /contributions/periods/current endpoint that the frontend uses
 * to determine what period name to display
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCurrentPeriodEndpoint() {
  console.log('=== Testing Frontend Current Period Endpoint ===\n');

  try {
    // Get any existing group
    const testGroup = await prisma.group.findFirst({
      include: {
        leader: true
      }
    });

    if (!testGroup) {
      console.log('❌ No test group found');
      return;
    }

    console.log(`🔍 Testing group: ${testGroup.name} (ID: ${testGroup.id})`);

    // Test the actual endpoint logic that the frontend calls
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: testGroup.id,
        totalCollectionThisPeriod: { not: null }
      },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ],
      include: {
        memberContributions: true
      }
    });

    if (currentPeriod) {
      console.log(`\n✅ Current Period Found:`);
      console.log(`   - ID: ${currentPeriod.id}`);
      console.log(`   - Meeting Date: ${currentPeriod.meetingDate}`);
      console.log(`   - Record Sequence: ${currentPeriod.recordSequenceNumber}`);
      console.log(`   - Period Name: ${currentPeriod.periodName || 'N/A'}`);
      console.log(`   - Total Collection: ₹${currentPeriod.totalCollectionThisPeriod}`);
      
      // Test what date this would show in the frontend
      const periodDate = new Date(currentPeriod.meetingDate);
      const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   - Frontend Display: "${monthYear}"`);
      
    } else {
      console.log('\n❌ No current period found');
    }

    // Also check what periods exist
    console.log(`\n📋 All periods for this group:`);
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: testGroup.id },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ]
    });

    allPeriods.forEach((period, index) => {
      const periodDate = new Date(period.meetingDate);
      const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   ${index + 1}. ${monthYear} (${period.meetingDate}) - Collection: ₹${period.totalCollectionThisPeriod || 'null'}`);
    });

    // Test a completely NEW group
    console.log(`\n🆕 Testing with a completely new group...`);
    
    // Create a new test group
    const newGroup = await prisma.group.create({
      data: {
        groupId: `TEST_FRONTEND_${Date.now()}`,
        name: `Frontend Test Group ${new Date().toISOString()}`,
        address: 'Test Address',
        leaderId: testGroup.leaderId, // Use same leader
        monthlyContribution: 100,
        interestRate: 2.0,
        collectionFrequency: 'MONTHLY'
      }
    });

    console.log(`   Created new group: ${newGroup.name} (ID: ${newGroup.id})`);

    // Check current period for new group
    const newGroupCurrentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: newGroup.id,
        totalCollectionThisPeriod: { not: null }
      },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ]
    });

    if (newGroupCurrentPeriod) {
      const periodDate = new Date(newGroupCurrentPeriod.meetingDate);
      const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   ✅ New group has current period: ${monthYear}`);
    } else {
      console.log(`   ❌ New group has NO current period - frontend will show current month`);
      
      // Show what the frontend fallback will display
      const today = new Date();
      const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`   📅 Frontend fallback will show: "${currentMonth}"`);
    }

    // Cleanup - delete the test group
    await prisma.group.delete({
      where: { id: newGroup.id }
    });
    console.log(`   🗑️ Cleaned up test group`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrentPeriodEndpoint();
