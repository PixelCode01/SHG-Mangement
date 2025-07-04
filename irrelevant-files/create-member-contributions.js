const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createMemberContributions() {
  try {
    console.log('Creating member contribution records...');

    // Get the group periodic record we just created
    const groupPeriodicRecord = await prisma.groupPeriodicRecord.findFirst({
      include: {
        memberRecords: {
          include: {
            member: {
              include: {
                users: true
              }
            }
          }
        },
        group: {
          include: {
            lateFineRules: {
              include: {
                tierRules: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!groupPeriodicRecord) {
      console.log('No group periodic record found');
      return;
    }

    console.log(`Found group periodic record: ${groupPeriodicRecord.id}`);
    console.log(`Member records: ${groupPeriodicRecord.memberRecords.length}`);

    const monthlyContribution = groupPeriodicRecord.group.monthlyContribution || 500;

    // Create member contributions for each member record
    for (const memberRecord of groupPeriodicRecord.memberRecords) {
      const isOverdue = memberRecord.compulsoryContribution === 0;
      const lateFineAmount = memberRecord.lateFinePaid || 0;
      
      // Set due date to last month (overdue)
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() - 1);
      dueDate.setDate(15); // 15th of last month

      const memberContribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: groupPeriodicRecord.id,
          memberId: memberRecord.member.id,
          compulsoryContributionDue: monthlyContribution,
          minimumDueAmount: monthlyContribution + lateFineAmount,
          compulsoryContributionPaid: memberRecord.compulsoryContribution || 0,
          lateFinePaid: lateFineAmount,
          totalPaid: (memberRecord.compulsoryContribution || 0) + lateFineAmount,
          status: isOverdue ? 'OVERDUE' : 'PAID',
          dueDate: dueDate,
          paidDate: isOverdue ? null : dueDate,
          daysLate: isOverdue ? 30 : 0, // 30 days overdue
          lateFineAmount: lateFineAmount,
          remainingAmount: isOverdue ? monthlyContribution : 0
        }
      });

      const userName = memberRecord.member.users?.[0]?.name || memberRecord.member.name;
      console.log(`Created member contribution for ${userName}: Due ${monthlyContribution}, Paid ${memberRecord.compulsoryContribution || 0}, Late Fine ${lateFineAmount}, Status ${isOverdue ? 'OVERDUE' : 'PAID'}`);
    }

    console.log('\nSuccess! Member contribution records created.');

  } catch (error) {
    console.error('Error creating member contributions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMemberContributions();
