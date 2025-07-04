const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createOpenPeriodForDebug() {
  try {
    console.log('Starting to create open period...');
    
    // Find a group with members
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          }
        },
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'desc' },
          take: 1
        }
      }
    });

    if (!group) {
      console.log('No groups found');
      return;
    }

    console.log(`Using group: ${group.name} (${group.memberships.length} members)`);

    // Create a new open period
    const nextSequence = group.groupPeriodicRecords.length > 0 
      ? group.groupPeriodicRecords[0].recordSequenceNumber + 1 
      : 1;

    const newPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: new Date(),
        recordSequenceNumber: nextSequence,
        standingAtStartOfPeriod: group.balanceInBank + group.cashInHand,
        // Leave totalCollectionThisPeriod as null to keep it open
      }
    });

    console.log(`Created open period ${nextSequence} for group ${group.name}`);

    // Create member contributions for each member
    const contributions = [];
    for (const membership of group.memberships) {
      const contribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: newPeriod.id,
          memberId: membership.memberId,
          compulsoryContributionDue: group.monthlyContribution,
          minimumDueAmount: group.monthlyContribution,
          compulsoryContributionPaid: group.monthlyContribution,
          totalPaid: group.monthlyContribution,
          status: 'PAID',
          dueDate: new Date(),
          paidDate: new Date(),
        }
      });
      contributions.push(contribution);
      console.log(`Added contribution for ${membership.member.name}: ${group.monthlyContribution}`);
    }

    console.log(`\n✓ Created open period with ${contributions.length} member contributions`);
    console.log(`Group ID: ${group.id}`);
    console.log(`Period ID: ${newPeriod.id}`);
    console.log('Ready for debugging period closing!');

  } catch (error) {
    console.error('Error creating open period:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createOpenPeriodForDebug();
