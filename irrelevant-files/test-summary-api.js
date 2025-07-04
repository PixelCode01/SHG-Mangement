const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSummaryData() {
  try {
    const groupId = '683c0f569d3d8075aa084255';
    
    // Simulate the exact query from summary API
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        leader: {
          select: { id: true, name: true, email: true }
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: groupId,
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 12,
          include: {
            memberRecords: true,
            loansIssuedThisPeriod: true,
            loanPaymentsReceivedThisPeriod: true
          }
        }
      }
    });

    if (group) {
      console.log('Group found with bank details:');
      console.log({
        id: group.id,
        name: group.name,
        bankAccountNumber: group.bankAccountNumber,
        bankName: group.bankName,
        totalMembers: group.memberships.length
      });
      
      // Simulate the groupInfo object creation
      const groupInfo = {
        id: group.id,
        name: group.name,
        leader: group.leader,
        totalMembers: group.memberships.length,
        dateOfStarting: group.dateOfStarting,
        address: group.address,
        organization: group.organization,
        bankAccountNumber: group.bankAccountNumber,
        bankName: group.bankName
      };
      
      console.log('\nGroupInfo object (as sent to frontend):');
      console.log(JSON.stringify(groupInfo, null, 2));
      
      // Test the UI condition
      const shouldShowBankDetails = !!(groupInfo.bankAccountNumber || groupInfo.bankName);
      console.log('\nShould show Group Details section:', shouldShowBankDetails);
      
    } else {
      console.log('Group not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSummaryData();
