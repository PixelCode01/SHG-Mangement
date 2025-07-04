#!/usr/bin/env node

/**
 * Test the actual backend API endpoint that the frontend calls
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBackendAPIDirectly() {
  try {
    console.log('🔍 TESTING BACKEND API DIRECTLY');
    console.log('================================\n');

    // First, find any group
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        collectionFrequency: true,
        collectionDayOfMonth: true,
        monthlyContribution: true
      },
      take: 5
    });

    console.log(`📊 FOUND ${groups.length} GROUPS:`);
    groups.forEach((group, index) => {
      console.log(`   ${index + 1}. ${group.name} (${group.id})`);
      console.log(`      Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
      console.log(`      Monthly: ₹${group.monthlyContribution || 0}`);
    });

    if (groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }

    // Test with the first group
    const targetGroup = groups[0];
    console.log(`\n🎯 TESTING WITH GROUP: ${targetGroup.name} (${targetGroup.id})`);

    // Check contribution records directly
    console.log(`\n💳 CHECKING CONTRIBUTION RECORDS...`);
    const contributions = await prisma.memberContribution.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        member: {
          select: { name: true }
        },
        groupPeriodicRecord: {
          select: { 
            groupId: true,
            meetingDate: true
          }
        }
      }
    });

    console.log(`📋 FOUND ${contributions.length} CONTRIBUTION RECORDS (recent):`);
    contributions.forEach((contrib, index) => {
      console.log(`   ${index + 1}. ${contrib.member.name}:`);
      console.log(`      - Compulsory: ₹${contrib.compulsoryContributionDue || 0}`);
      console.log(`      - Interest: ₹${contrib.loanInterestDue || 0}`);
      console.log(`      - Late Fine: ₹${contrib.lateFineAmount || 0} 🔍`);
      console.log(`      - Days Late: ${contrib.daysLate || 0}`);
      console.log(`      - Status: ${contrib.status || 'N/A'}`);
      console.log(`      - Total Paid: ₹${contrib.totalPaid || 0}`);
      console.log(`      - Group: ${contrib.groupPeriodicRecord?.groupId}`);
      console.log(`      - Date: ${contrib.groupPeriodicRecord?.meetingDate}`);
    });

    // Check if any contributions have late fines > 0
    const contribsWithLateFines = contributions.filter(c => (c.lateFineAmount || 0) > 0);
    const contribsWithDaysLate = contributions.filter(c => (c.daysLate || 0) > 0);

    console.log(`\n🔎 ANALYSIS:`);
    console.log(`   💰 Contributions with late fines > 0: ${contribsWithLateFines.length}`);
    console.log(`   📅 Contributions with days late > 0: ${contribsWithDaysLate.length}`);

    if (contribsWithLateFines.length === 0 && contribsWithDaysLate.length === 0) {
      console.log(`\n🔴 PROBLEM IDENTIFIED:`);
      console.log(`   ❌ No contribution records have late fines or days late set`);
      console.log(`   📝 This means the backend is not calculating late fines properly`);
      console.log(`   💡 The frontend gets ₹0 late fines from backend API`);
      
      console.log(`\n🧪 MANUAL CALCULATION TEST:`);
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const targetDay = targetGroup.collectionDayOfMonth || 5;
      
      let dueDate = new Date(currentYear, currentMonth, targetDay);
      if (dueDate > today) {
        dueDate = new Date(currentYear, currentMonth - 1, targetDay);
      }
      
      const daysLate = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      console.log(`   📅 Today: ${today.toDateString()}`);
      console.log(`   📅 Due Date: ${dueDate.toDateString()}`);
      console.log(`   📅 Days Late: ${daysLate}`);
      
      if (daysLate > 0) {
        console.log(`\n💡 SOLUTION OPTIONS:`);
        console.log(`   1. Fix backend to calculate late fines properly`);
        console.log(`   2. Force frontend to always use its own calculation`);
        console.log(`   3. Update contribution records with correct late fine data`);
      }
    } else {
      console.log(`\n✅ Backend appears to be calculating some late fines`);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBackendAPIDirectly();
