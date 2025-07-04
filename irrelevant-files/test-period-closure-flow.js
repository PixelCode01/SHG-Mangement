const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodClosureFlow() {
  try {
    console.log('=== Testing Period Closure Flow ===');
    
    // Find a group with an open period
    const groups = await prisma.group.findMany({
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'desc' },
          take: 2
        }
      }
    });
    
    if (groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    const group = groups[0];
    console.log(`\n📊 Testing Group: ${group.name} (ID: ${group.id})`);
    console.log(`   Collection Frequency: ${group.collectionFrequency || 'MONTHLY'}`);
    
    if (group.groupPeriodicRecords.length === 0) {
      console.log('❌ No periods found for this group');
      return;
    }
    
    console.log(`\n🗓️ Current Periods:`);
    group.groupPeriodicRecords.forEach((period, index) => {
      console.log(`   ${index + 1}. Period #${period.recordSequenceNumber || 'N/A'}`);
      console.log(`      - Meeting Date: ${period.meetingDate.toLocaleDateString()}`);
      console.log(`      - Total Collection: ₹${period.totalCollectionThisPeriod?.toFixed(2) || 'N/A'}`);
      console.log(`      - Cash in Hand: ₹${period.cashInHandAtEndOfPeriod?.toFixed(2) || 'N/A'}`);
      console.log(`      - Cash in Bank: ₹${period.cashInBankAtEndOfPeriod?.toFixed(2) || 'N/A'}`);
      console.log(`      - Total Standing: ₹${period.totalGroupStandingAtEndOfPeriod?.toFixed(2) || 'N/A'}`);
      console.log(`      - Created: ${period.createdAt.toLocaleString()}`);
      console.log(`      - Updated: ${period.updatedAt.toLocaleString()}`);
    });
    
    const currentPeriod = group.groupPeriodicRecords[0];
    
    // Check if current period has contributions
    const contributions = await prisma.memberContribution.findMany({
      where: {
        groupPeriodicRecordId: currentPeriod.id
      },
      include: {
        member: {
          select: { name: true }
        }
      }
    });
    
    console.log(`\n💰 Contributions for Current Period (${currentPeriod.recordSequenceNumber}):`);
    console.log(`   Found ${contributions.length} contribution records`);
    
    if (contributions.length > 0) {
      contributions.slice(0, 3).forEach((contrib, index) => {
        console.log(`   ${index + 1}. ${contrib.member.name}`);
        console.log(`      - Due: ₹${contrib.compulsoryContributionDue.toFixed(2)}`);
        console.log(`      - Paid: ₹${contrib.totalPaid.toFixed(2)}`);
        console.log(`      - Status: ${contrib.status}`);
        console.log(`      - Remaining: ₹${contrib.remainingAmount.toFixed(2)}`);
      });
    }
    
    // Check if period appears to be ready for closure
    const isPeriodClosed = currentPeriod.totalCollectionThisPeriod !== null && currentPeriod.totalCollectionThisPeriod !== 0;
    console.log(`\n🔒 Period Status:`);
    console.log(`   - Is Closed: ${isPeriodClosed}`);
    console.log(`   - Total Collection: ₹${currentPeriod.totalCollectionThisPeriod?.toFixed(2) || 'N/A'}`);
    
    if (!isPeriodClosed) {
      console.log(`\n⚠️ Period appears to be open and ready for closure`);
      console.log(`\n🔗 Test period closure at:`);
      console.log(`   http://localhost:3000/groups/${group.id}/contributions`);
      console.log(`\n📝 Steps to test:`);
      console.log(`   1. Open the contributions page`);
      console.log(`   2. Record some contributions for members`);
      console.log(`   3. Click "Close Period" button`);
      console.log(`   4. Verify new period is created and displayed`);
    } else {
      console.log(`\n✅ Period is already closed`);
      console.log(`   After closure, the next period should be automatically created`);
    }
    
    console.log(`\n🎯 Expected Behavior After Period Closure:`);
    console.log(`   1. Current period gets updated with final totals`);
    console.log(`   2. New period is created with next meeting date`);
    console.log(`   3. New member contributions are created for the new period`);
    console.log(`   4. Frontend refreshes and shows the new period`);
    console.log(`   5. Users can immediately start tracking contributions for new period`);
    
  } catch (error) {
    console.error('❌ Error testing period closure flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosureFlow();
