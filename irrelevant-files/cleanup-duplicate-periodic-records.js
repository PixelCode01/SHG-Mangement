const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicatePeriodicRecords() {
  console.log('Starting cleanup of duplicate periodic records...');

  try {
    // Get all groups
    const groups = await prisma.group.findMany({
      select: { id: true, name: true }
    });

    console.log(`Found ${groups.length} groups to check for duplicate records.`);

    for (const group of groups) {
      console.log(`\nChecking group: ${group.name} (${group.id})`);
      
      // Get all periodic records for this group
      const records = await prisma.groupPeriodicRecord.findMany({
        where: { groupId: group.id },
        orderBy: [
          { recordSequenceNumber: 'asc' }, // First order by sequence number
          { createdAt: 'asc' } // Then by creation date for duplicates
        ],
        select: {
          id: true,
          recordSequenceNumber: true,
          meetingDate: true,
          totalCollectionThisPeriod: true,
          createdAt: true,
          updatedAt: true,
          memberContributions: { select: { id: true, totalPaid: true } }
        }
      });

      console.log(`Found ${records.length} periodic records for this group.`);
      
      // Find duplicate sequence numbers
      const seqCounts = {};
      records.forEach(record => {
        const seqNum = record.recordSequenceNumber;
        if (!seqNum) return; // Skip if no sequence number
        
        seqCounts[seqNum] = (seqCounts[seqNum] || 0) + 1;
      });
      
      const duplicateSeqs = Object.entries(seqCounts)
        .filter(([_, count]) => count > 1)
        .map(([seq]) => parseInt(seq));
        
      if (duplicateSeqs.length === 0) {
        console.log('No duplicates found for this group.');
        continue;
      }
      
      console.log(`Found ${duplicateSeqs.length} duplicate sequence numbers: ${duplicateSeqs.join(', ')}`);
      
      // Process each duplicate sequence
      for (const seqNum of duplicateSeqs) {
        const dupes = records.filter(r => r.recordSequenceNumber === seqNum);
        console.log(`\nSequence #${seqNum} has ${dupes.length} records:`);
        
        dupes.forEach((record, index) => {
          const hasMemberRecords = record.memberContributions && record.memberContributions.length > 0;
          const hasCollection = record.totalCollectionThisPeriod !== null && record.totalCollectionThisPeriod !== undefined;
          console.log(`  ${index + 1}. ID: ${record.id} | Created: ${record.createdAt.toISOString()} | Updated: ${record.updatedAt.toISOString()}`);
          console.log(`     Collection: ${record.totalCollectionThisPeriod || 0} | Member records: ${record.memberContributions?.length || 0}`);
        });
        
        // Keep the valid record, which has actual data and member records
        const validRecord = dupes.find(r => 
          r.totalCollectionThisPeriod !== null && 
          r.totalCollectionThisPeriod !== undefined && 
          r.totalCollectionThisPeriod > 0 && 
          r.memberContributions?.length > 0
        );
        
        if (validRecord) {
          // If we found a valid record, delete the others
          const recordsToDelete = dupes
            .filter(r => r.id !== validRecord.id)
            .map(r => r.id);
          
          if (recordsToDelete.length > 0) {
            console.log(`Will keep record ${validRecord.id} (has collection data) and delete ${recordsToDelete.length} duplicate(s).`);
            console.log(`Do you want to proceed with deletion? (y/n)`);
            // Simulated confirmation since we're in a script
            console.log('Simulating confirmation: y');
            
            // Delete the duplicate records
            for (const recordId of recordsToDelete) {
              console.log(`Deleting record ${recordId}...`);
              try {
                // Delete member contributions first to prevent foreign key issues
                await prisma.memberContribution.deleteMany({
                  where: { groupPeriodicRecordId: recordId }
                });
                
                // Now delete the periodic record itself
                await prisma.groupPeriodicRecord.delete({
                  where: { id: recordId }
                });
                
                console.log(`Record ${recordId} deleted successfully.`);
              } catch (deleteErr) {
                console.error(`Error deleting record ${recordId}:`, deleteErr);
              }
            }
          }
        } else {
          // If no valid record found, keep the newest one only
          const sortedByDate = [...dupes].sort((a, b) => b.createdAt - a.createdAt);
          const keepRecord = sortedByDate[0];
          const recordsToDelete = sortedByDate
            .slice(1)
            .map(r => r.id);
          
          if (recordsToDelete.length > 0) {
            console.log(`No valid record found, will keep newest record ${keepRecord.id} and delete ${recordsToDelete.length} older duplicate(s).`);
            console.log(`Do you want to proceed with deletion? (y/n)`);
            // Simulated confirmation
            console.log('Simulating confirmation: y');
            
            // Delete the older duplicate records
            for (const recordId of recordsToDelete) {
              console.log(`Deleting record ${recordId}...`);
              try {
                // Delete member contributions first
                await prisma.memberContribution.deleteMany({
                  where: { groupPeriodicRecordId: recordId }
                });
                
                // Now delete the periodic record
                await prisma.groupPeriodicRecord.delete({
                  where: { id: recordId }
                });
                
                console.log(`Record ${recordId} deleted successfully.`);
              } catch (deleteErr) {
                console.error(`Error deleting record ${recordId}:`, deleteErr);
              }
            }
          }
        }
      }
    }
    
    console.log('\nDuplicate record cleanup completed!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup function
cleanupDuplicatePeriodicRecords();
