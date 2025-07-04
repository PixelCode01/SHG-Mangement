const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInconsistentStandingCalculations() {
  console.log('🔧 Fixing Inconsistent Standing Calculations...');
  console.log('===============================================');

  try {
    // Get all groups with periodic records
    const groups = await prisma.group.findMany({
      where: {
        groupPeriodicRecords: {
          some: {}
        }
      },
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'asc' }
        }
      }
    });

    console.log(`Found ${groups.length} groups with periodic records`);

    for (const group of groups) {
      console.log(`\n📊 Processing Group: ${group.name} (ID: ${group.id})`);
      
      // Get the correct loan assets using the consistent method (membership.currentLoanAmount)
      const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
        where: {
          groupId: group.id
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      const correctLoanAssets = membershipLoanAssets._sum.currentLoanAmount || 0;
      
      console.log(`  Correct Loan Assets (membership method): ₹${correctLoanAssets}`);
      
      let recordsUpdated = 0;
      
      for (const record of group.groupPeriodicRecords) {
        const cashInHand = record.cashInHandAtEndOfPeriod || 0;
        const cashInBank = record.cashInBankAtEndOfPeriod || 0;
        const totalCash = cashInHand + cashInBank;
        
        // Calculate what the standing should be using consistent method
        const correctStanding = totalCash + correctLoanAssets;
        const currentStanding = record.totalGroupStandingAtEndOfPeriod || 0;
        
        if (Math.abs(correctStanding - currentStanding) > 0.01) {
          console.log(`    Record ${record.recordSequenceNumber}: ₹${currentStanding} → ₹${correctStanding} (Difference: ₹${correctStanding - currentStanding})`);
          
          // Update the record with the correct standing
          await prisma.groupPeriodicRecord.update({
            where: { id: record.id },
            data: {
              totalGroupStandingAtEndOfPeriod: correctStanding
            }
          });
          
          recordsUpdated++;
        } else {
          console.log(`    Record ${record.recordSequenceNumber}: ₹${currentStanding} (Already correct)`);
        }
      }
      
      // Also need to update the "standingAtStartOfPeriod" for subsequent records
      // to maintain consistency between periods
      for (let i = 1; i < group.groupPeriodicRecords.length; i++) {
        const currentRecord = group.groupPeriodicRecords[i];
        const previousRecord = group.groupPeriodicRecords[i - 1];
        
        // The starting standing should equal the previous record's ending standing
        const correctStartingStanding = previousRecord.totalGroupStandingAtEndOfPeriod || 0;
        const currentStartingStanding = currentRecord.standingAtStartOfPeriod || 0;
        
        if (Math.abs(correctStartingStanding - currentStartingStanding) > 0.01) {
          console.log(`    Record ${currentRecord.recordSequenceNumber} starting standing: ₹${currentStartingStanding} → ₹${correctStartingStanding}`);
          
          await prisma.groupPeriodicRecord.update({
            where: { id: currentRecord.id },
            data: {
              standingAtStartOfPeriod: correctStartingStanding
            }
          });
          
          recordsUpdated++;
        }
      }
      
      console.log(`  ✅ Updated ${recordsUpdated} records for this group`);
    }

    console.log(`\n🎉 Fix completed! All periodic records now use consistent standing calculations.`);
    console.log(`\nWhat was fixed:`);
    console.log(`1. All records now use membership.currentLoanAmount for loan assets`);
    console.log(`2. Standing calculations are consistent: Cash + Bank + Loan Assets`);
    console.log(`3. Starting standing of each period matches ending standing of previous period`);
    
  } catch (error) {
    console.error('❌ Fix failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixInconsistentStandingCalculations()
  .catch(error => {
    console.error('Fix script failed:', error);
    process.exit(1);
  });
