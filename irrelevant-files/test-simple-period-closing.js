/**
 * Simple test for period closing functionality
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodClosingSimple() {
  console.log('🧪 TESTING PERIOD CLOSING - SIMPLE VERSION\n');

  try {
    const groupId = '68466fdfad5c6b70fdd420d7';
    const recordId = '68467e501b91ace792ba15ef'; // The open record we identified
    
    // Get the record details
    const record = await prisma.groupPeriodicRecord.findUnique({
      where: { id: recordId },
      include: {
        memberContributions: true,
        group: true
      }
    });
    
    if (!record) {
      console.log('❌ Record not found');
      return;
    }
    
    console.log('📋 CURRENT RECORD STATE:');
    console.log(`Record ID: ${record.id}`);
    console.log(`Group: ${record.group.name}`);
    console.log(`Meeting Date: ${record.meetingDate}`);
    console.log(`Standing Start: ₹${record.standingAtStartOfPeriod}`);
    console.log(`Current Collection: ₹${record.totalCollectionThisPeriod || 'Not set'}`);
    console.log(`End Standing: ₹${record.totalGroupStandingAtEndOfPeriod || 'Not set'}`);
    console.log(`Member Contributions: ${record.memberContributions.length}`);
    console.log('');
    
    // Calculate what the closing should produce
    const totalContributions = record.memberContributions.reduce((sum, contrib) => {
      const contribution = contrib.contributionAmount || 0;
      const fine = contrib.fineAmount || 0;
      console.log(`  ${contrib.member?.name || 'Unknown'}: ₹${contribution} + ₹${fine} fine`);
      return sum + contribution + fine;
    }, 0);
    
    console.log('🧮 CLOSING CALCULATIONS:');
    console.log(`Total from contributions: ₹${totalContributions}`);
    
    if (totalContributions > 0) {
      const expectedEndStanding = (record.standingAtStartOfPeriod || 0) + totalContributions;
      
      // Cash allocation (70% bank, 30% hand) with rounding
      const bankAmount = Math.round((totalContributions * 0.7 + Number.EPSILON) * 100) / 100;
      const handAmount = Math.round((totalContributions * 0.3 + Number.EPSILON) * 100) / 100;
      
      console.log(`Expected end standing: ₹${expectedEndStanding}`);
      console.log(`Cash to bank (70%): ₹${bankAmount}`);
      console.log(`Cash to hand (30%): ₹${handAmount}`);
      console.log('');
      
      console.log('✅ PERIOD READY TO CLOSE');
      console.log('🎯 To test via API, send POST request to:');
      console.log(`   URL: /api/groups/${groupId}/contributions/periods/close`);
      console.log(`   Body: { "periodId": "${recordId}", "memberContributions": [...], "actualContributions": {...} }`);
      
    } else {
      console.log('❌ No contributions found to close');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosingSimple();
