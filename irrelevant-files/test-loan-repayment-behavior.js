const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLoanRepaymentBehavior() {
  try {
    console.log('=== TESTING LOAN REPAYMENT BEHAVIOR ===\n');

    // Find a group with active loans and recent periodic records
    const group = await prisma.group.findFirst({
      where: {
        memberships: {
          some: {
            member: {
              loans: {
                some: {
                  status: 'ACTIVE',
                  currentBalance: {
                    gt: 0
                  }
                }
              }
            }
          }
        }
      },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 3
        }
      }
    });

    if (!group) {
      console.log('❌ No group with active loans found for testing');
      return;
    }

    console.log(`✅ Found test group: ${group.name} (ID: ${group.id})`);
    
    // Show current loan status
    const membersWithLoans = group.memberships.filter(m => m.member.loans.length > 0);
    console.log(`\n💰 Current Loans Status:`);
    let totalCurrentLoans = 0;
    
    membersWithLoans.forEach(membership => {
      const member = membership.member;
      const loanBalance = member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      totalCurrentLoans += loanBalance;
      
      if (loanBalance > 0) {
        console.log(`  - ${member.name}: ₹${loanBalance.toLocaleString()}`);
      }
    });
    
    console.log(`  Total Active Loans: ₹${totalCurrentLoans.toLocaleString()}`);

    // Show recent periodic records
    console.log(`\n📊 Recent Periodic Records:`);
    group.groupPeriodicRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.meetingDate.toISOString().split('T')[0]} - Standing: ₹${(record.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
    });

    // Show what would happen with a loan repayment
    console.log(`\n🧪 THEORETICAL TEST:`);
    console.log(`If a member repays ₹1,000 loan principal:`);
    console.log(`  ✓ Loan Assets should DECREASE by ₹1,000`);
    console.log(`  ✓ Cash Balance should INCREASE by ₹1,000`);
    console.log(`  ✓ Total Group Standing should REMAIN UNCHANGED`);
    console.log(`  ❌ Group Standing should NOT increase by ₹1,000`);

    if (group.groupPeriodicRecords.length >= 2) {
      const latest = group.groupPeriodicRecords[0];
      const previous = group.groupPeriodicRecords[1];
      const standingChange = (latest.totalGroupStandingAtEndOfPeriod || 0) - (previous.totalGroupStandingAtEndOfPeriod || 0);
      
      console.log(`\n📈 Recent Standing Change:`);
      console.log(`  Previous: ₹${(previous.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
      console.log(`  Latest: ₹${(latest.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
      console.log(`  Change: ${standingChange >= 0 ? '+' : ''}₹${standingChange.toLocaleString()}`);
      
      if (Math.abs(standingChange) > 10000) {
        console.log(`  ⚠️  Large change detected - may indicate loan repayment affecting standing`);
      }
    }

    // Test URL for creating a new record
    console.log(`\n🔗 Test URL:`);
    console.log(`http://localhost:3000/groups/${group.id}/periodic-records/create`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLoanRepaymentBehavior();
