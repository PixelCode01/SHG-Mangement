#!/usr/bin/env node

// Test the current contributions API to see what data the frontend receives

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCurrentContributionsAPI() {
  try {
    console.log('=== Testing Current Contributions API Data ===');
    
    const groupId = '68499d8a8ebb724c0ebedf0d';
    
    // Simulate the API call that the frontend makes
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
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
        },
        cashAllocations: {
          orderBy: { lastModifiedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!currentRecord) {
      console.log('No current record found');
      return;
    }

    console.log('Current Period:', {
      id: currentRecord.id,
      meetingDate: currentRecord.meetingDate.toISOString(),
      month: currentRecord.meetingDate.toISOString().substring(0, 7)
    });

    console.log('\n=== Sample Member Contribution Data ===');
    const sampleContrib = currentRecord.memberContributions[0];
    if (sampleContrib) {
      console.log('Member:', sampleContrib.member.name);
      console.log('Due Date:', sampleContrib.dueDate?.toISOString());
      console.log('Days Late:', sampleContrib.daysLate);
      console.log('Late Fine Amount:', sampleContrib.lateFineAmount);
      console.log('Status:', sampleContrib.status);
      console.log('Total Paid:', sampleContrib.totalPaid);
      console.log('Remaining Amount:', sampleContrib.remainingAmount);
      
      // Check if this is the July period showing 8 days
      if (currentRecord.meetingDate.toISOString().includes('2025-07')) {
        console.log('\n🔍 ISSUE CHECK: July Period Data');
        console.log('Expected: July period should show 0 days late');
        console.log(`Actual: ${sampleContrib.daysLate} days late`);
        console.log(`Status: ${sampleContrib.daysLate === 0 ? '✅ FIXED' : '❌ STILL BROKEN'}`);
      }
    }

    // Check all contribution statuses
    console.log('\n=== All Members Summary ===');
    currentRecord.memberContributions.forEach((contrib, index) => {
      console.log(`${index + 1}. ${contrib.member.name}: ${contrib.daysLate} days late, ₹${contrib.lateFineAmount} fine`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrentContributionsAPI();
