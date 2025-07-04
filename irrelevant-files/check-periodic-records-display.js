const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPeriodicRecordsDisplay() {
  try {
    console.log('=== Checking Periodic Records for Display ===');
    
    // Get a group with periodic records
    const groups = await prisma.group.findMany({
      include: {
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 3
        }
      }
    });
    
    if (groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    console.log(`✅ Found ${groups.length} groups`);
    
    for (const group of groups) {
      console.log(`\n📊 Group: ${group.name} (ID: ${group.id})`);
      console.log(`   Records: ${group.groupPeriodicRecords.length}`);
      
      if (group.groupPeriodicRecords.length > 0) {
        console.log('   Latest records:');
        group.groupPeriodicRecords.forEach((record, index) => {
          console.log(`   ${index + 1}. Meeting #${record.recordSequenceNumber || 'N/A'} on ${record.meetingDate.toLocaleDateString()}`);
          console.log(`      - Members Present: ${record.membersPresent || 'N/A'}`);
          console.log(`      - Cash in Hand: ₹${record.cashInHandAtEndOfPeriod?.toFixed(2) || 'N/A'}`);
          console.log(`      - Cash in Bank: ₹${record.cashInBankAtEndOfPeriod?.toFixed(2) || 'N/A'}`);
          console.log(`      - Total Standing: ₹${record.totalGroupStandingAtEndOfPeriod?.toFixed(2) || 'N/A'}`);
          console.log(`      - Total Collection: ₹${record.totalCollectionThisPeriod?.toFixed(2) || 'N/A'}`);
        });
        
        console.log(`\n🔗 View this group's periodic records at:`);
        console.log(`   http://localhost:3000/groups/${group.id}/periodic-records`);
        break; // Just show first group with records
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking periodic records:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPeriodicRecordsDisplay();
