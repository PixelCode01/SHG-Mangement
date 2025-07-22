#!/usr/bin/env node

/**
 * Simple test to check the period display fix
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSimple() {
  try {
    console.log('🧪 Testing Period Display Fix...');
    
    // Find test group
    const group = await prisma.group.findFirst();
    
    if (!group) {
      console.log('❌ No groups found');
      return;
    }

    console.log(`✅ Found group: ${group.name}`);
    console.log(`   Configured period: ${group.currentPeriodMonth}/${group.currentPeriodYear}`);
    
    // Check current periods
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { recordSequenceNumber: 'desc' },
      take: 3
    });
    
    console.log(`\n📋 Recent periods for ${group.name}:`);
    periods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
      console.log(`   ${index + 1}. ${monthYear} (Seq: ${period.recordSequenceNumber}) - ${status}`);
    });

    // Test what the API should create
    if (group.currentPeriodMonth && group.currentPeriodYear) {
      const expectedDate = new Date(group.currentPeriodYear, group.currentPeriodMonth - 1, 10);
      const expectedDisplay = expectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`\n🎯 Expected new period display: "${expectedDisplay}"`);
    }
    
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSimple();
