#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function getGroupIds() {
  const prisma = new PrismaClient();
  
  try {
    const groups = await prisma.group.findMany({
      select: { id: true, name: true },
      take: 3
    });
    
    console.log('Available groups:');
    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} (${group.id})`);
    });
    
    if (groups.length > 0) {
      const testGroupId = groups[0].id;
      console.log(`\nTesting current period API for group: ${testGroupId}`);
      
      // Make API call
      try {
        const response = await fetch(`http://localhost:3001/api/groups/${testGroupId}/contributions/periods/current`);
        console.log(`API Response Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('API Response:', JSON.stringify(data, null, 2));
          
          if (data.period) {
            const periodDate = new Date(data.period.startDate);
            const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            console.log(`\n📅 Frontend will show: "${monthYear}"`);
          }
        } else {
          const errorText = await response.text();
          console.log('API Error:', errorText);
        }
      } catch (fetchError) {
        console.log('Fetch Error:', fetchError.message);
      }
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getGroupIds();
