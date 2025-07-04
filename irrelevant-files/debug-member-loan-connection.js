const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugMemberLoanConnection() {
  try {
    const recordId = '68381a3405cb588247af8752';
    const groupId = '68381a2c05cb588247af871e';
    
    console.log('=== DEBUGGING MEMBER-LOAN CONNECTION ===');
    
    // Get the periodic record with member details
    const record = await prisma.groupPeriodicRecord.findUnique({
      where: { id: recordId },
      include: {
        memberRecords: {
          include: {
            member: true
          }
        }
      }
    });
    
    console.log('\nMembers in periodic record:');
    record.memberRecords.forEach((mr, index) => {
      console.log(`  ${index + 1}. ID: ${mr.memberId}, Name: ${mr.member.name}`);
    });
    
    // Get all loans in the group
    const loans = await prisma.loan.findMany({
      where: {
        groupId: groupId,
        status: 'ACTIVE'
      },
      include: {
        member: true
      }
    });
    
    console.log('\nLoans in the group:');
    loans.forEach((loan, index) => {
      console.log(`  ${index + 1}. Member ID: ${loan.memberId}, Name: ${loan.member.name}, Balance: ${loan.currentBalance}`);
    });
    
    // Check for matches
    console.log('\n=== MATCHING ANALYSIS ===');
    const memberIdsInRecord = record.memberRecords.map(mr => mr.memberId);
    const memberIdsWithLoans = loans.map(loan => loan.memberId);
    
    console.log('Member IDs in periodic record:', memberIdsInRecord);
    console.log('Member IDs with loans:', memberIdsWithLoans);
    
    const matches = memberIdsInRecord.filter(id => memberIdsWithLoans.includes(id));
    console.log('Matching member IDs:', matches);
    
    // Test the exact query the API uses
    console.log('\n=== TESTING API QUERY ===');
    const apiStyleRecord = await prisma.groupPeriodicRecord.findUnique({
      where: {
        id: recordId,
        groupId: groupId,
      },
      include: {
        memberRecords: {
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
        }
      }
    });
    
    console.log('\nAPI-style query results:');
    apiStyleRecord.memberRecords.forEach((mr, index) => {
      console.log(`  Member ${index + 1}: ${mr.member.name}`);
      console.log(`    Loans: ${mr.member.loans.length}`);
      mr.member.loans.forEach((loan, loanIndex) => {
        console.log(`      Loan ${loanIndex + 1}: Balance ${loan.currentBalance}`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMemberLoanConnection();
