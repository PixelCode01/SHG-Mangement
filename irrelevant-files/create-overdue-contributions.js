const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createOverdueContributions() {
  try {
    console.log('Creating overdue contributions for testing late fines...');

    // Get a group with late fine rules
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: {
              include: {
                users: true
              }
            }
          }
        },
        lateFineRules: true
      }
    });

    if (!group) {
      console.log('No group found');
      return;
    }

    console.log(`Found group: ${group.name}`);
    console.log(`Members: ${group.memberships.length}`);
    console.log(`Late fine rules: ${group.lateFineRules.length}`);

    // Create a period that's overdue (from last month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    console.log(`Creating period from ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // First create a GroupPeriodicRecord
    const groupPeriodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: periodEnd // Use period end as meeting date
      }
    });

    console.log(`Created group periodic record: ${groupPeriodicRecord.id}`);

    // Create member periodic records for each member with some overdue contributions
    for (let i = 0; i < group.memberships.length; i++) {
      const membership = group.memberships[i];
      
      // Make some contributions overdue (50% of members)
      const isOverdue = i % 2 === 0;
      const contributionAmount = isOverdue ? 0 : group.monthlyContribution; // 0 means not paid
      
      const memberPeriodicRecord = await prisma.groupMemberPeriodicRecord.create({
        data: {
          groupPeriodicRecordId: groupPeriodicRecord.id,
          memberId: membership.member.id,
          compulsoryContribution: contributionAmount,
          lateFinePaid: isOverdue ? 50 : 0 // Add a late fine for overdue members
        }
      });

      console.log(`Created member periodic record for ${membership.member.id}, contribution: ${contributionAmount}, late fine: ${isOverdue ? 50 : 0}`);
    }

    // Now check what we created
    const groupPeriodicRecords = await prisma.groupPeriodicRecord.findMany({
      include: {
        memberRecords: {
          include: {
            member: {
              include: {
                users: true
              }
            }
          }
        }
      }
    });

    console.log(`\nCreated ${groupPeriodicRecords.length} group periodic records:`);
    groupPeriodicRecords.forEach(record => {
      console.log(`Group Record ${record.id}:`);
      record.memberRecords.forEach(memberRecord => {
        const userName = memberRecord.member.users?.[0]?.name || memberRecord.member.name;
        console.log(`- ${userName}: Contribution ${memberRecord.compulsoryContribution}, Late Fine: ${memberRecord.lateFinePaid}`);
      });
    });

    console.log('\nSuccess! Overdue contributions created for testing late fines.');

  } catch (error) {
    console.error('Error creating overdue contributions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createOverdueContributions();
