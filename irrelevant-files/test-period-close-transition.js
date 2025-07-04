#!/usr/bin/env node

/**
 * Test script to validate period closing and next period transition
 * This will help us diagnose the issue where period close doesn't move to next period
 */

const { PrismaClient } = require('@prisma/client');

async function testPeriodCloseTransition() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== Testing Period Close to Next Period Transition ===\n');
    
    // Get a test group
    const testGroup = await prisma.group.findFirst({
      include: {
        leader: true,
        memberships: {
          include: {
            member: true
          }
        }
      }
    });
    
    if (!testGroup) {
      console.log('❌ No test group found');
      return;
    }
    
    console.log(`🔍 Using test group: ${testGroup.name} (ID: ${testGroup.id})`);
    console.log(`   Leader: ${testGroup.leader.name}`);
    console.log(`   Members: ${testGroup.memberships.length}`);
    
    // 1. Check current period via API
    console.log('\n📋 Step 1: Check current period via API...');
    
    try {
      const currentPeriodResponse = await fetch(`http://localhost:3001/api/groups/${testGroup.id}/contributions/periods/current`);
      
      if (currentPeriodResponse.ok) {
        const currentPeriodData = await currentPeriodResponse.json();
        console.log('✅ Current period found:');
        console.log(`   - ID: ${currentPeriodData.period.id}`);
        console.log(`   - Date: ${currentPeriodData.period.startDate}`);
        console.log(`   - Sequence: ${currentPeriodData.period.periodNumber}`);
        console.log(`   - Is Closed: ${currentPeriodData.period.isClosed}`);
        
        const periodDate = new Date(currentPeriodData.period.startDate);
        const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        console.log(`   - Display Name: "${monthYear}"`);
        
        // 2. Check if there are any contributions for this period
        console.log('\n📋 Step 2: Check member contributions for current period...');
        
        const contributions = await prisma.memberContribution.findMany({
          where: { groupPeriodicRecordId: currentPeriodData.period.id },
          include: { member: { select: { name: true } } }
        });
        
        console.log(`   Found ${contributions.length} member contribution records`);
        
        if (contributions.length > 0) {
          const totalPaid = contributions.reduce((sum, c) => sum + c.totalPaid, 0);
          const totalExpected = contributions.reduce((sum, c) => sum + c.compulsoryContributionDue, 0);
          console.log(`   - Total paid: ₹${totalPaid}`);
          console.log(`   - Total expected: ₹${totalExpected}`);
          console.log(`   - Completion: ${totalExpected > 0 ? ((totalPaid / totalExpected) * 100).toFixed(1) : 0}%`);
        }
        
        // 3. Simulate what happens after period close
        console.log('\n📋 Step 3: Check what would happen after period close...');
        
        // Check if there's already a next period created
        const nextPeriodSequence = (currentPeriodData.period.periodNumber || 0) + 1;
        const nextPeriod = await prisma.groupPeriodicRecord.findFirst({
          where: {
            groupId: testGroup.id,
            recordSequenceNumber: nextPeriodSequence
          }
        });
        
        if (nextPeriod) {
          console.log(`   ✅ Next period already exists (Sequence: ${nextPeriod.recordSequenceNumber})`);
          console.log(`   - Next Period ID: ${nextPeriod.id}`);
          console.log(`   - Next Period Date: ${nextPeriod.meetingDate}`);
          console.log(`   - Next Period Collection: ₹${nextPeriod.totalCollectionThisPeriod}`);
          
          const nextPeriodDate = new Date(nextPeriod.meetingDate);
          const nextMonthYear = nextPeriodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          console.log(`   - Next Period Display: "${nextMonthYear}"`);
        } else {
          console.log(`   ❌ No next period exists yet (would be sequence ${nextPeriodSequence})`);
          console.log(`   - Period close would need to create the next period`);
        }
        
        // 4. Test current period API logic specifically
        console.log('\n📋 Step 4: Test current period API selection logic...');
        
        // Simulate the API logic: find periods for current month that are open
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        const currentMonthPeriods = await prisma.groupPeriodicRecord.findMany({
          where: {
            groupId: testGroup.id,
            meetingDate: {
              gte: new Date(currentYear, currentMonth, 1),
              lt: new Date(currentYear, currentMonth + 1, 1)
            }
          },
          orderBy: [
            { meetingDate: 'desc' },
            { recordSequenceNumber: 'desc' }
          ]
        });
        
        console.log(`   Found ${currentMonthPeriods.length} periods for current month (${currentMonth + 1}/${currentYear})`);
        
        currentMonthPeriods.forEach((period, index) => {
          const isOpen = period.totalCollectionThisPeriod === null || period.totalCollectionThisPeriod === 0;
          const periodDate = new Date(period.meetingDate);
          const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          console.log(`   ${index + 1}. ${monthYear} (Seq: ${period.recordSequenceNumber}) - ${isOpen ? 'OPEN' : 'CLOSED'}`);
        });
        
      } else {
        console.log('❌ Failed to fetch current period from API');
        const errorText = await currentPeriodResponse.text();
        console.log('Error:', errorText);
      }
      
    } catch (error) {
      console.error('❌ API test failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodCloseTransition();
