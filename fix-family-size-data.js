// Manual fix script for family size data
// Run this if the database is missing family size information

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Family size data from your JSON
const familySizeData = [
  { name: 'Anup Kumar Keshri', familyMembersCount: 2 },
  { name: 'Santosh Mishra', familyMembersCount: 3 },
  { name: 'Ashok Kumar Keshri', familyMembersCount: 1 },
  { name: 'Pramod Kumar Keshri', familyMembersCount: 1 },
  { name: 'Manoj Mishra', familyMembersCount: 1 },
  { name: 'Vikki Thakur', familyMembersCount: 1 },
  { name: 'Sunil Kumar Mahto', familyMembersCount: 1 },
  { name: 'Pawan Kumar', familyMembersCount: 1 },
  { name: 'Sudama Prasad', familyMembersCount: 1 },
  { name: 'Vijay Keshri', familyMembersCount: 14 },
  { name: 'Uday Prasad Keshri', familyMembersCount: 1 },
  { name: 'Pooja Kumari', familyMembersCount: 1 },
  { name: 'Krishna Kumar Keshri', familyMembersCount: 1 },
  { name: 'Kavita Keshri', familyMembersCount: 1 },
  { name: 'Jyoti Keshri', familyMembersCount: 1 },
  { name: 'Manoj Keshri', familyMembersCount: 1 },
  { name: 'Jaleshwar Mahto', familyMembersCount: 1 },
  { name: 'Surendra Mahto', familyMembersCount: 1 },
  { name: 'Dilip Kumar Rajak', familyMembersCount: 2 },
  { name: 'Sudhakar Kumar', familyMembersCount: 4 },
  { name: 'Sanjay Keshri', familyMembersCount: 1 },
  { name: 'Sudhir Kumar', familyMembersCount: 1 },
  { name: 'Mangal Mahto', familyMembersCount: 1 },
  { name: 'Kiran Devi', familyMembersCount: 1 },
  { name: 'Subhash Maheshwari', familyMembersCount: 1 },
  { name: 'Sikandar K Mahto', familyMembersCount: 1 },
  { name: 'Achal Kumar Ojha', familyMembersCount: 1 },
  { name: 'Umesh Prasad Keshri', familyMembersCount: 1 },
  { name: 'Anuj Kumar Toppo', familyMembersCount: 1 },
  { name: 'Jitendra Shekhar', familyMembersCount: 1 },
  { name: 'Rajesh Kumar', familyMembersCount: 1 },
  { name: 'Manish Oraon', familyMembersCount: 1 },
  { name: 'Ganesh Prasad Keshri', familyMembersCount: 1 },
  { name: 'Shyam Kumar Keshri', familyMembersCount: 1 },
  { name: 'Shankar Mahto', familyMembersCount: 1 },
  { name: 'Subodh Kumar', familyMembersCount: 1 },
  { name: 'Sunil Oraon', familyMembersCount: 1 },
  { name: 'Gopal Prasad Keshri', familyMembersCount: 1 },
  { name: 'Rakesh Kumar Sinha', familyMembersCount: 1 },
  { name: 'Sikandar Hajam', familyMembersCount: 1 },
  { name: 'Sunil Kumar Keshri', familyMembersCount: 1 },
  { name: 'Jag Mohan Modi', familyMembersCount: 1 },
  { name: 'Uma Shankar Keshri', familyMembersCount: 1 },
  { name: 'Shiv Shankar Mahto', familyMembersCount: 1 },
  { name: 'Gudiya Devi', familyMembersCount: 1 },
  { name: 'Jayprakash Singh', familyMembersCount: 1 },
  { name: 'Meera Kumari', familyMembersCount: 1 },
  { name: 'Vishal H Shah', familyMembersCount: 1 },
  { name: 'Rohit Priy Raj', familyMembersCount: 1 },
  { name: 'Anand K Chitlangia', familyMembersCount: 1 },
  { name: 'Aishwarya Singh', familyMembersCount: 1 }
];

async function fixFamilySizeData() {
  try {
    console.log("🔧 Starting family size data fix...\n");
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const memberData of familySizeData) {
      try {
        const result = await prisma.member.updateMany({
          where: {
            name: memberData.name
          },
          data: {
            familyMembersCount: memberData.familyMembersCount
          }
        });
        
        if (result.count > 0) {
          console.log(`✅ Updated ${memberData.name}: ${memberData.familyMembersCount} family members`);
          updatedCount++;
        } else {
          console.log(`❌ Not found: ${memberData.name}`);
          notFoundCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${memberData.name}:`, error.message);
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`✅ Updated: ${updatedCount} members`);
    console.log(`❌ Not Found: ${notFoundCount} members`);
    console.log(`📊 Total Processed: ${familySizeData.length} members`);
    
    // Verify the updates
    console.log("\n🔍 Verifying updates...");
    const sampleMembers = await prisma.member.findMany({
      where: {
        name: {
          in: ['Anup Kumar Keshri', 'Santosh Mishra', 'Vijay Keshri', 'Sudhakar Kumar']
        }
      },
      select: {
        name: true,
        familyMembersCount: true
      }
    });
    
    sampleMembers.forEach(member => {
      console.log(`${member.name}: ${member.familyMembersCount} family members`);
    });
    
  } catch (error) {
    console.error('Fix script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFamilySizeData();
