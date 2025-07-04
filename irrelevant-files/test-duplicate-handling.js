const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDuplicateContributionHandling() {
  console.log('🔍 TESTING DUPLICATE CONTRIBUTION HANDLING');
  console.log('==========================================\n');

  try {
    // Find a group with members and a periodic record
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 1
        }
      }
    });

    if (!group || group.memberships.length === 0) {
      console.log('❌ No suitable group found for testing');
      return;
    }

    const testMember = group.memberships[0].member;
    let currentRecord = group.groupPeriodicRecords[0];

    console.log(`📋 Group: ${group.name}`);
    console.log(`👤 Member: ${testMember.name}`);
    
    // Ensure we have a periodic record
    if (!currentRecord) {
      const nextSequenceNumber = await prisma.groupPeriodicRecord.count({
        where: { groupId: group.id }
      }) + 1;

      currentRecord = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: group.id,
          meetingDate: new Date(),
          recordSequenceNumber: nextSequenceNumber,
          standingAtStartOfPeriod: 0,
          newContributionsThisPeriod: 0,
          totalGroupStandingAtEndOfPeriod: 0,
          cashInHandAtEndOfPeriod: 0,
          cashInBankAtEndOfPeriod: 0,
          membersPresent: 0
        }
      });
      console.log(`📅 Created new periodic record: ${currentRecord.id}`);
    } else {
      console.log(`📊 Using existing periodic record: ${currentRecord.id}`);
    }

    // Check initial state
    const initialContributions = await prisma.memberContribution.findMany({
      where: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: testMember.id
      }
    });

    console.log(`\n📊 Initial contributions for this member: ${initialContributions.length}`);

    // Test scenario: Try to create contribution using the fixed logic
    console.log('\n🧪 Testing upsert logic...');
    
    const defaultContributionAmount = group.monthlyContribution || 100;
    const loanInterestDue = 25;
    const minimumDueAmount = defaultContributionAmount + loanInterestDue;
    const dueDate = new Date(currentRecord.meetingDate);
    dueDate.setMonth(dueDate.getMonth() + 1); // Assuming monthly

    // First upsert
    console.log('🔄 First upsert operation...');
    const result1 = await prisma.memberContribution.upsert({
      where: {
        groupPeriodicRecordId_memberId: {
          groupPeriodicRecordId: currentRecord.id,
          memberId: testMember.id
        }
      },
      update: {
        compulsoryContributionDue: defaultContributionAmount,
        loanInterestDue: loanInterestDue,
        minimumDueAmount: minimumDueAmount,
        remainingAmount: minimumDueAmount,
        dueDate: dueDate,
        updatedAt: new Date()
      },
      create: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: testMember.id,
        compulsoryContributionDue: defaultContributionAmount,
        loanInterestDue: loanInterestDue,
        minimumDueAmount: minimumDueAmount,
        remainingAmount: minimumDueAmount,
        dueDate: dueDate,
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0
      }
    });

    console.log(`✅ First result: ${result1.id} (Due: ₹${result1.minimumDueAmount})`);

    // Second upsert with different values
    console.log('🔄 Second upsert operation (should update)...');
    const result2 = await prisma.memberContribution.upsert({
      where: {
        groupPeriodicRecordId_memberId: {
          groupPeriodicRecordId: currentRecord.id,
          memberId: testMember.id
        }
      },
      update: {
        compulsoryContributionDue: defaultContributionAmount + 50,
        loanInterestDue: loanInterestDue + 15,
        minimumDueAmount: minimumDueAmount + 65,
        remainingAmount: minimumDueAmount + 65,
        dueDate: dueDate,
        updatedAt: new Date()
      },
      create: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: testMember.id,
        compulsoryContributionDue: defaultContributionAmount,
        loanInterestDue: loanInterestDue,
        minimumDueAmount: minimumDueAmount,
        remainingAmount: minimumDueAmount,
        dueDate: dueDate,
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0
      }
    });

    console.log(`✅ Second result: ${result2.id} (Due: ₹${result2.minimumDueAmount})`);

    // Verify final state
    const finalContributions = await prisma.memberContribution.findMany({
      where: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: testMember.id
      }
    });

    console.log(`\n📊 Final contributions for this member: ${finalContributions.length}`);

    // Verification
    if (result1.id === result2.id) {
      console.log('✅ SAME RECORD UPDATED (NO DUPLICATE CREATED)');
    } else {
      console.log('❌ DIFFERENT RECORDS - DUPLICATE CREATED!');
    }

    if (finalContributions.length === 1) {
      console.log('✅ EXACTLY ONE CONTRIBUTION RECORD EXISTS');
    } else {
      console.log(`❌ ${finalContributions.length} CONTRIBUTION RECORDS EXIST`);
    }

    if (result2.minimumDueAmount > result1.minimumDueAmount) {
      console.log('✅ RECORD WAS PROPERLY UPDATED');
    } else {
      console.log('❌ RECORD WAS NOT UPDATED');
    }

    console.log('\n🎉 DUPLICATE HANDLING TEST COMPLETED!');
    console.log(`📊 Final state: ${finalContributions.length} record(s)`);
    console.log(`💰 Final amount: ₹${result2.minimumDueAmount}`);

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    if (error.code === 'P2002') {
      console.error('💥 DUPLICATE CONSTRAINT ERROR!');
      console.error('   This indicates the fix is not working properly.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDuplicateContributionHandling();
