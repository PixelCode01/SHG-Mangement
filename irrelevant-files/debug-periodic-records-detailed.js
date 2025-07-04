const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugPeriodicRecords() {
  try {
    console.log('=== DETAILED PERIODIC RECORDS DEBUG ===\n');

    // Get all periodic records with full details
    const records = await prisma.groupPeriodicRecord.findMany({
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
            memberId: true,
            status: true,
            totalPaid: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${records.length} periodic records:\n`);

    records.forEach((record, index) => {
      console.log(`--- Record ${index + 1} ---`);
      console.log(`ID: ${record.id}`);
      console.log(`Group: ${record.group?.name} (${record.group?.id})`);
      console.log(`Meeting Date: ${record.meetingDate}`);
      console.log(`Sequence Number: ${record.recordSequenceNumber}`);
      console.log(`Created: ${record.createdAt}`);
      console.log(`Updated: ${record.updatedAt}`);
      console.log('--- Financial Data ---');
      console.log(`Total Collection This Period: ${record.totalCollectionThisPeriod}`);
      console.log(`Standing at Start: ${record.standingAtStartOfPeriod}`);
      console.log(`Cash in Bank at End: ${record.cashInBankAtEndOfPeriod}`);
      console.log(`Cash in Hand at End: ${record.cashInHandAtEndOfPeriod}`);
      console.log(`Total Group Standing at End: ${record.totalGroupStandingAtEndOfPeriod}`);
      console.log(`Interest Earned: ${record.interestEarnedThisPeriod}`);
      console.log(`New Contributions: ${record.newContributionsThisPeriod}`);
      console.log(`Late Fines: ${record.lateFinesCollectedThisPeriod}`);
      console.log(`Member Contributions: ${record.memberContributions?.length || 0}`);
      
      // Check for June 2025
      const meetingDate = new Date(record.meetingDate);
      if (meetingDate.getMonth() === 5 && meetingDate.getFullYear() === 2025) { // June = month 5
        console.log('🎯 JUNE 2025 RECORD FOUND!');
      }
      
      console.log('');
    });

    // Check for duplicate groups
    console.log('=== CHECKING FOR DUPLICATES ===\n');
    const groupCounts = {};
    records.forEach(record => {
      const groupId = record.group?.id;
      if (!groupCounts[groupId]) {
        groupCounts[groupId] = [];
      }
      groupCounts[groupId].push(record);
    });

    Object.entries(groupCounts).forEach(([groupId, groupRecords]) => {
      if (groupRecords.length > 1) {
        console.log(`🚨 Group ${groupRecords[0].group?.name} has ${groupRecords.length} records:`);
        groupRecords.forEach(record => {
          console.log(`  - ${record.id} (${record.createdAt})`);
        });
        console.log('');
      }
    });

    // Check for records with null/undefined critical fields
    console.log('=== CHECKING FOR INCOMPLETE RECORDS ===\n');
    const incompleteRecords = records.filter(record => 
      record.totalCollectionThisPeriod === null || 
      record.totalCollectionThisPeriod === undefined ||
      record.recordSequenceNumber === null ||
      record.recordSequenceNumber === undefined
    );

    if (incompleteRecords.length > 0) {
      console.log(`Found ${incompleteRecords.length} incomplete records:`);
      incompleteRecords.forEach(record => {
        console.log(`- ${record.id} (${record.group?.name}): totalCollection=${record.totalCollectionThisPeriod}, seqNum=${record.recordSequenceNumber}`);
      });
    } else {
      console.log('No incomplete records found.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPeriodicRecords();
