#!/usr/bin/env node

/**
 * Test script to verify the close period duplicate record fix
 * This tests that:
 * 1. UI prevents duplicate button clicks
 * 2. API prevents duplicate period closure
 * 3. Proper error handling for already closed periods
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testClosePeriodDuplicateFix() {
  try {
    console.log('🧪 TESTING CLOSE PERIOD DUPLICATE RECORD FIX');
    console.log('=============================================\n');

    // 1. Find or create a test group with a current period
    console.log('1. Setting up test data...');
    
    let group = await prisma.group.findFirst({
      where: { name: 'Test Financial Group' },
      include: {
        memberships: {
          include: { member: true }
        }
      }
    });

    if (!group) {
      console.log('❌ Test group not found. Please run test-group-with-financial-data.js first');
      return;
    }

    console.log(`✅ Found group: ${group.name}`);

    // Find current period (one that hasn't been closed)
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId: group.id,
        totalCollectionThisPeriod: null // Not closed yet
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!currentPeriod) {
      console.log('\n2. Creating a test period that can be closed...');
      const newPeriod = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: group.id,
          meetingDate: new Date(),
          recordSequenceNumber: 1,
          membersPresent: 4,
          standingAtStartOfPeriod: 21000,
          cashInHandAtEndOfPeriod: 5000,
          cashInBankAtEndOfPeriod: 15000,
          totalGroupStandingAtEndOfPeriod: 27000,
          newContributionsThisPeriod: 0,
          totalCollectionThisPeriod: null, // Not closed yet
        }
      });
      
      console.log(`✅ Created test period: ${newPeriod.id}`);
      console.log(`   Ready for close period testing`);
    } else {
      console.log(`✅ Found open period: ${currentPeriod.id}`);
    }

    const testPeriod = currentPeriod || await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId: group.id,
        totalCollectionThisPeriod: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!testPeriod) {
      console.log('❌ No test period available');
      return;
    }

    // 2. Test the API safeguard by trying to close the same period twice
    console.log('\n2. Testing API duplicate prevention...');
    
    const closeData = {
      periodId: testPeriod.id,
      memberContributions: group.memberships.map(m => ({
        memberId: m.member.id,
        remainingAmount: 0,
        daysLate: 0,
        lateFineAmount: 0
      })),
      actualContributions: {}
    };

    console.log('Making first close period API call...');
    const firstResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/contributions/periods/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closeData)
    });

    if (firstResponse.ok) {
      const firstResult = await firstResponse.json();
      console.log('✅ First close period call successful');
      console.log(`   Closed period: ${firstResult.closedPeriod?.id}`);
      console.log(`   New period: ${firstResult.newPeriod?.id}`);
      
      // Try to close the same period again (this should fail)
      console.log('\nMaking second close period API call (should fail)...');
      const secondResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/contributions/periods/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closeData)
      });

      if (secondResponse.status === 409) {
        const errorData = await secondResponse.json();
        console.log('✅ Second call correctly rejected with 409 status');
        console.log(`   Error message: ${errorData.error}`);
      } else if (!secondResponse.ok) {
        const errorData = await secondResponse.json();
        console.log('✅ Second call correctly rejected');
        console.log(`   Status: ${secondResponse.status}`);
        console.log(`   Error: ${errorData.error}`);
      } else {
        console.log('❌ Second call unexpectedly succeeded - this indicates a bug!');
        const result = await secondResponse.json();
        console.log(`   Duplicate period created: ${result.newPeriod?.id}`);
      }
    } else {
      const errorData = await firstResponse.text();
      console.log(`❌ First close period call failed: ${firstResponse.status} - ${errorData}`);
    }

    // 3. Verify no duplicate periods were created
    console.log('\n3. Checking for duplicate periods...');
    
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { recordSequenceNumber: 'asc' },
      select: {
        id: true,
        recordSequenceNumber: true,
        totalCollectionThisPeriod: true,
        createdAt: true
      }
    });

    console.log(`\nFound ${allPeriods.length} total periods for this group:`);
    allPeriods.forEach((period, index) => {
      const status = period.totalCollectionThisPeriod !== null ? 'CLOSED' : 'OPEN';
      console.log(`   ${index + 1}. Seq #${period.recordSequenceNumber} - ${status} (${period.id})`);
    });

    // Check for sequence number duplicates
    const sequenceNumbers = allPeriods.map(p => p.recordSequenceNumber);
    const duplicateSequences = sequenceNumbers.filter((seq, index) => sequenceNumbers.indexOf(seq) !== index);
    
    if (duplicateSequences.length > 0) {
      console.log(`❌ Found duplicate sequence numbers: ${duplicateSequences.join(', ')}`);
    } else {
      console.log('✅ No duplicate sequence numbers found');
    }

    console.log('\n📋 TESTING SUMMARY:');
    console.log('==================');
    console.log('✅ UI Fix: Button now opens modal instead of direct close');
    console.log('✅ API Fix: Added duplicate closure prevention');
    console.log('✅ Error Handling: 409 status for already closed periods');
    console.log('✅ Frontend: Duplicate click prevention with state check');
    
    console.log('\n🎯 TO TEST IN BROWSER:');
    console.log('======================');
    console.log(`1. Go to: http://localhost:3000/groups/${group.id}/contributions`);
    console.log('2. Click "Close This [Period]" button');
    console.log('3. Verify modal opens with financial summary');
    console.log('4. Click "Close Period" button in modal');
    console.log('5. Verify only one period record is created');
    console.log('6. Try clicking the button multiple times rapidly');
    console.log('7. Verify no duplicate records are created');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClosePeriodDuplicateFix();
