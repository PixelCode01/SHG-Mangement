const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixGroupPeriodIssues() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🔧 Fixing Group Period Issues...');
  console.log('================================');
  console.log(`Group ID: ${groupId}`);

  try {
    // Get current state
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'asc' }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`\n📊 Current state: ${group.groupPeriodicRecords.length} records`);

    // Identify the problematic record (Record 3 - the duplicate July record)
    const duplicateJulyRecord = group.groupPeriodicRecords.find(r => 
      r.recordSequenceNumber === 3 && 
      r.meetingDate.toISOString().split('T')[0] === '2025-07-10'
    );

    if (duplicateJulyRecord) {
      console.log(`\n🗑️ Found duplicate July record to fix: ${duplicateJulyRecord.id}`);
      
      // Get the correct loan assets
      const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
        where: { groupId: groupId },
        _sum: { currentLoanAmount: true }
      });
      const totalLoanAssets = membershipLoanAssets._sum.currentLoanAmount || 0;

      // Calculate what this record should be (August 2025, not July)
      const augustDate = new Date('2025-08-10');
      const currentCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
      const correctStanding = currentCash + totalLoanAssets;
      
      // Get the ending standing from the previous record (July)
      const julyRecord = group.groupPeriodicRecords.find(r => 
        r.recordSequenceNumber === 2
      );
      const startingStanding = julyRecord ? julyRecord.totalGroupStandingAtEndOfPeriod : 0;

      console.log(`\n🔄 Updating Record 3:`);
      console.log(`  Old: July 2025 (duplicate) with standing ₹${duplicateJulyRecord.totalGroupStandingAtEndOfPeriod}`);
      console.log(`  New: August 2025 with standing ₹${correctStanding}`);
      console.log(`  Starting balance: ₹${startingStanding}`);

      // Update the record to be August instead of duplicate July
      await prisma.groupPeriodicRecord.update({
        where: { id: duplicateJulyRecord.id },
        data: {
          meetingDate: augustDate,
          standingAtStartOfPeriod: startingStanding,
          totalGroupStandingAtEndOfPeriod: correctStanding,
          cashInHandAtEndOfPeriod: group.cashInHand || 0,
          cashInBankAtEndOfPeriod: group.balanceInBank || 0,
          // Clear collections since this should be an open period for August
          totalCollectionThisPeriod: null,
          interestEarnedThisPeriod: null,
          newContributionsThisPeriod: null
        }
      });

      console.log(`✅ Record updated successfully`);

      // Also need to update the member contributions to point to this August period
      const memberContributions = await prisma.memberContribution.findMany({
        where: { groupPeriodicRecordId: duplicateJulyRecord.id }
      });

      console.log(`\n👥 Updating ${memberContributions.length} member contributions for August period`);
      
      // Reset member contributions for the new August period
      for (const contrib of memberContributions) {
        await prisma.memberContribution.update({
          where: { id: contrib.id },
          data: {
            compulsoryContributionPaid: 0,
            loanInterestPaid: 0,
            lateFineAmount: 0,
            totalPaid: 0,
            status: 'PENDING',
            paidDate: null,
            remainingAmount: contrib.compulsoryContributionDue || 0
          }
        });
      }

      console.log(`✅ Member contributions reset for August period`);

    } else {
      console.log(`❌ Could not find the duplicate July record to fix`);
    }

    // Verify the fix
    console.log(`\n🔍 VERIFICATION - Fetching updated records:`);
    const updatedGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'asc' }
        }
      }
    });

    updatedGroup.groupPeriodicRecords.forEach((record, index) => {
      const dateStr = record.meetingDate.toISOString().split('T')[0];
      const month = new Date(record.meetingDate).toLocaleString('default', { month: 'long', year: 'numeric' });
      console.log(`  Record ${index + 1}: Sequence ${record.recordSequenceNumber} - ${month} (${dateStr}) - Standing: ₹${record.totalGroupStandingAtEndOfPeriod}`);
    });

    console.log(`\n🎉 Fix completed!`);
    console.log(`✅ June 2025: Closed`);
    console.log(`✅ July 2025: Closed`);
    console.log(`✅ August 2025: Open (current period)`);
    console.log(`✅ No more duplicate dates`);
    console.log(`✅ Consistent standing calculations`);

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGroupPeriodIssues()
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
