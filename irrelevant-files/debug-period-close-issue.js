const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugPeriodCloseIssue() {
  try {
    console.log('=== DEBUGGING PERIOD CLOSE ISSUE ===\n');

    // Get the group that has the duplicates
    const duplicateGroup = await prisma.groupPeriodicRecord.findMany({
      where: {
        groupId: '6842f4b27ae430995f48ee2d' // ewff group
      },
      include: {
        group: {
          select: {
            name: true,
            id: true
          }
        },
        memberContributions: {
          select: {
            id: true,
            status: true,
            totalPaid: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${duplicateGroup.length} records for group ewff:\n`);

    duplicateGroup.forEach((record, index) => {
      console.log(`--- Record ${index + 1} ---`);
      console.log(`ID: ${record.id}`);
      console.log(`Meeting Date: ${record.meetingDate}`);
      console.log(`Sequence Number: ${record.recordSequenceNumber}`);
      console.log(`Total Collection: ${record.totalCollectionThisPeriod} (${typeof record.totalCollectionThisPeriod})`);
      console.log(`Created: ${record.createdAt}`);
      console.log(`Updated: ${record.updatedAt}`);
      console.log(`Member Contributions: ${record.memberContributions?.length || 0}`);
      
      // Check if this record would pass the duplicate check
      const isConsideredClosed = record.totalCollectionThisPeriod !== null && record.totalCollectionThisPeriod !== undefined;
      console.log(`Would pass duplicate check (is closed): ${isConsideredClosed}`);
      console.log('');
    });

    // Check the exact condition the backend uses
    console.log('=== CHECKING BACKEND LOGIC ===\n');
    
    // Simulate the backend check for the first record
    const firstRecord = duplicateGroup[0];
    if (firstRecord) {
      console.log(`First record (${firstRecord.id}):`);
      console.log(`totalCollectionThisPeriod: ${firstRecord.totalCollectionThisPeriod}`);
      console.log(`!== null: ${firstRecord.totalCollectionThisPeriod !== null}`);
      console.log(`!== undefined: ${firstRecord.totalCollectionThisPeriod !== undefined}`);
      console.log(`Combined check: ${firstRecord.totalCollectionThisPeriod !== null && firstRecord.totalCollectionThisPeriod !== undefined}`);
      
      if (firstRecord.totalCollectionThisPeriod !== null && firstRecord.totalCollectionThisPeriod !== undefined) {
        console.log('❌ This record would be considered CLOSED and should prevent duplicates');
      } else {
        console.log('✅ This record would be considered OPEN and allow closure');
      }
      console.log('');
    }

    // Check for any data inconsistencies
    console.log('=== CHECKING FOR ISSUES ===\n');
    
    let foundIssues = false;
    
    // Check for records created too close together (potential race condition)
    for (let i = 1; i < duplicateGroup.length; i++) {
      const prev = duplicateGroup[i - 1];
      const curr = duplicateGroup[i];
      const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
      
      if (timeDiff < 5000) { // Less than 5 seconds
        console.log(`⚠️  POTENTIAL RACE CONDITION: Records ${prev.id} and ${curr.id} created ${timeDiff}ms apart`);
        foundIssues = true;
      }
    }
    
    // Check for records with inconsistent sequence numbers
    const sequences = duplicateGroup.map(r => r.recordSequenceNumber).sort((a, b) => a - b);
    const expectedSequences = [...Array(sequences.length)].map((_, i) => i + 1);
    
    if (JSON.stringify(sequences) !== JSON.stringify(expectedSequences)) {
      console.log(`⚠️  SEQUENCE NUMBER ISSUE: Expected [${expectedSequences.join(', ')}], got [${sequences.join(', ')}]`);
      foundIssues = true;
    }
    
    // Check for records where one should have prevented the other
    const closedRecords = duplicateGroup.filter(r => 
      r.totalCollectionThisPeriod !== null && r.totalCollectionThisPeriod !== undefined
    );
    
    if (closedRecords.length > 1) {
      console.log(`⚠️  MULTIPLE CLOSED RECORDS: ${closedRecords.length} records are marked as closed`);
      foundIssues = true;
    }
    
    if (!foundIssues) {
      console.log('✅ No obvious data issues found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPeriodCloseIssue();
