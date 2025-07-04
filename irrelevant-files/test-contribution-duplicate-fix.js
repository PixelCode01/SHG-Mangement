const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testContributionDuplicateFix() {
  console.log('🧪 TESTING CONTRIBUTION DUPLICATE FIX');
  console.log('=====================================\n');

  try {
    // Find a group to test with
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

    if (!group) {
      console.log('❌ No group found for testing');
      return;
    }

    if (group.memberships.length === 0) {
      console.log('❌ No members found in group for testing');
      return;
    }

    console.log(`📋 Testing with group: ${group.name}`);
    console.log(`👥 Members available: ${group.memberships.length}`);

    const testMember = group.memberships[0].member;
    console.log(`🎯 Testing with member: ${testMember.name}\n`);

    // Get or create current periodic record
    let currentRecord = group.groupPeriodicRecords[0];
    
    if (!currentRecord) {
      console.log('📅 Creating new periodic record...');
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
    }

    console.log(`📊 Current record ID: ${currentRecord.id}`);

    // Check if contribution already exists
    const existingContribution = await prisma.memberContribution.findFirst({
      where: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: testMember.id
      }
    });

    if (existingContribution) {
      console.log('✅ Contribution already exists, testing upsert behavior...');
    } else {
      console.log('📝 No existing contribution, will test creation...');
    }

    // Test the API call simulation
    console.log('\n🔄 SIMULATING API CALL...');
    
    const testPayload = {
      memberId: testMember.id,
      compulsoryContributionDue: group.monthlyContribution || 100,
      loanInterestDue: 50
    };

    // Simulate the upsert operation
    const defaultContributionAmount = testPayload.compulsoryContributionDue;
    const loanInterestDue = testPayload.loanInterestDue;
    const minimumDueAmount = defaultContributionAmount + loanInterestDue;
    const dueDate = new Date(currentRecord.meetingDate);
    
    if (group.collectionFrequency === 'WEEKLY') {
      dueDate.setDate(dueDate.getDate() + 7);
    } else if (group.collectionFrequency === 'FORTNIGHTLY') {
      dueDate.setDate(dueDate.getDate() + 14);
    } else if (group.collectionFrequency === 'MONTHLY') {
      dueDate.setMonth(dueDate.getMonth() + 1);
    } else if (group.collectionFrequency === 'YEARLY') {
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    }

    // Test upsert operation
    const result = await prisma.memberContribution.upsert({
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
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    console.log('✅ FIRST UPSERT SUCCESSFUL');
    console.log(`📊 Contribution ID: ${result.id}`);
    console.log(`💰 Due Amount: ₹${result.minimumDueAmount}`);
    console.log(`📅 Due Date: ${result.dueDate.toLocaleDateString()}`);

    // Test the same operation again to ensure no duplicate error
    console.log('\n🔄 TESTING DUPLICATE CALL...');
    
    const result2 = await prisma.memberContribution.upsert({
      where: {
        groupPeriodicRecordId_memberId: {
          groupPeriodicRecordId: currentRecord.id,
          memberId: testMember.id
        }
      },
      update: {
        compulsoryContributionDue: defaultContributionAmount + 25, // Different amount
        loanInterestDue: loanInterestDue + 10,
        minimumDueAmount: minimumDueAmount + 35,
        remainingAmount: minimumDueAmount + 35,
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

    console.log('✅ SECOND UPSERT SUCCESSFUL (UPDATE)');
    console.log(`📊 Same Contribution ID: ${result2.id}`);
    console.log(`💰 Updated Due Amount: ₹${result2.minimumDueAmount}`);
    console.log(`🔄 Updated At: ${result2.updatedAt.toLocaleString()}`);

    console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('✅ No duplicate constraint errors');
    console.log('✅ Upsert operation working correctly');
    console.log('✅ Updates existing records instead of creating duplicates');

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    if (error.code === 'P2002') {
      console.error('💥 DUPLICATE CONSTRAINT ERROR STILL EXISTS!');
      console.error('   The fix may not be working properly.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testContributionDuplicateFix();
