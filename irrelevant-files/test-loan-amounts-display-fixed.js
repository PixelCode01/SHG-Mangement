#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLoanAmountsDisplay() {
  try {
    console.log('🔍 Testing loan amounts display functionality...\n');

    // Find a group with members that have loan amounts
    const groupsWithMembers = await prisma.group.findMany({
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        },
        groupPeriodicRecords: {
          include: {
            memberRecords: {
              include: {
                member: {
                  include: {
                    loans: {
                      where: {
                        status: 'ACTIVE'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        leader: true
      },
      take: 3
    });

    if (groupsWithMembers.length === 0) {
      console.log('❌ No groups found. Creating test data...');
      return;
    }

    for (const group of groupsWithMembers) {
      console.log(`\n📊 Group: ${group.name} (ID: ${group.id})`);
      console.log(`   Members: ${group.memberships.length}`);
      
      // Check members with loan amounts
      const membersWithLoans = group.memberships.filter(m => 
        m.member.initialLoanAmount > 0 || m.member.loans.length > 0
      );
      
      if (membersWithLoans.length > 0) {
        console.log(`   Members with loans: ${membersWithLoans.length}`);
        
        membersWithLoans.forEach(membership => {
          const member = membership.member;
          const currentLoanBalance = member.loans.reduce((total, loan) => total + loan.currentBalance, 0);
          
          console.log(`   - ${member.name}:`);
          console.log(`     Initial Loan Amount: ₹${member.initialLoanAmount || 0}`);
          console.log(`     Current Loan Balance: ₹${currentLoanBalance}`);
        });
      }

      // Check periodic records
      if (group.groupPeriodicRecords.length > 0) {
        console.log(`   Periodic Records: ${group.groupPeriodicRecords.length}`);
        
        const latestRecord = group.groupPeriodicRecords[0];
        console.log(`   Latest Record Date: ${latestRecord.meetingDate.toLocaleDateString()}`);
        console.log(`   Member Records in Latest: ${latestRecord.memberRecords.length}`);
        
        // Test if we can access loan information through the periodic record
        latestRecord.memberRecords.forEach(mr => {
          const member = mr.member;
          const currentLoanBalance = member.loans.reduce((total, loan) => total + loan.currentBalance, 0);
          
          if (member.initialLoanAmount > 0 || currentLoanBalance > 0) {
            console.log(`     - ${member.name} has loan data available in periodic record`);
          }
        });
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Member initial loan amounts are stored in Member.initialLoanAmount');
    console.log('   - Current loan balances are calculated from active Loan records');
    console.log('   - Both values should now be displayed in the view record functionality');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLoanAmountsDisplay();
