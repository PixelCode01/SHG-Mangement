#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function checkPeriodsForGroup() {
  const prisma = new PrismaClient();
  
  try {
    const groupId = '68481425f418d2300b2df585';
    console.log(`Checking periods for group: ${groupId}\n`);
    
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ]
    });
    
    console.log('All periods:');
    periods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`${index + 1}. ${monthYear} (Seq: ${period.recordSequenceNumber})`);
      console.log(`   - ID: ${period.id}`);
      console.log(`   - Meeting Date: ${period.meetingDate}`);
      console.log(`   - Total Collection: ${period.totalCollectionThisPeriod}`);
      console.log(`   - Status: ${period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED'}`);
      console.log('');
    });
    
    // Check if July should be closed by seeing if there are contributions
    const julyPeriod = periods.find(p => {
      const date = new Date(p.meetingDate);
      return date.getMonth() === 6 && date.getFullYear() === 2025; // July 2025
    });
    
    if (julyPeriod) {
      console.log('July period found, checking for contributions...');
      const contributions = await prisma.memberContribution.findMany({
        where: { groupPeriodicRecordId: julyPeriod.id }
      });
      
      console.log(`   - Member contributions: ${contributions.length}`);
      if (contributions.length > 0) {
        const totalPaid = contributions.reduce((sum, c) => sum + c.totalPaid, 0);
        console.log(`   - Total paid: ₹${totalPaid}`);
        
        if (totalPaid > 0) {
          console.log('   🚨 July has contributions but is marked as open! Should be closed.');
          
          // Fix this by closing the July period
          console.log('   🔧 Closing July period...');
          await prisma.groupPeriodicRecord.update({
            where: { id: julyPeriod.id },
            data: { totalCollectionThisPeriod: totalPaid }
          });
          console.log('   ✅ July period closed');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPeriodsForGroup();
