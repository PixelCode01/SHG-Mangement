// Test script to directly verify family size data in the database
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFamilySizeData() {
  try {
    console.log("=== TESTING FAMILY SIZE DATA IN DATABASE ===\n");
    
    // Get all members with their family size data
    const members = await prisma.member.findMany({
      select: {
        id: true,
        name: true,
        familyMembersCount: true,
        groupMemberships: {
          select: {
            group: {
              select: {
                id: true,
                name: true,
                groupSocialEnabled: true,
                groupSocialAmountPerFamilyMember: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${members.length} members in the database:\n`);

    // Check specifically for the members from your JSON data
    const expectedData = [
      { name: 'Anup Kumar Keshri', expectedFamily: 2 },
      { name: 'Santosh Mishra', expectedFamily: 3 },
      { name: 'Ashok Kumar Keshri', expectedFamily: 1 },
      { name: 'Pramod Kumar Keshri', expectedFamily: 1 },
      { name: 'Manoj Mishra', expectedFamily: 1 },
      { name: 'Vikki Thakur', expectedFamily: 1 },
      { name: 'Sunil Kumar Mahto', expectedFamily: 1 },
      { name: 'Pawan Kumar', expectedFamily: 1 },
      { name: 'Sudama Prasad', expectedFamily: 1 },
      { name: 'Vijay Keshri', expectedFamily: 14 },
      { name: 'Uday Prasad Keshri', expectedFamily: 1 },
      { name: 'Pooja Kumari', expectedFamily: 1 },
      { name: 'Krishna Kumar Keshri', expectedFamily: 1 },
      { name: 'Kavita Keshri', expectedFamily: 1 },
      { name: 'Jyoti Keshri', expectedFamily: 1 },
      { name: 'Manoj Keshri', expectedFamily: 1 },
      { name: 'Jaleshwar Mahto', expectedFamily: 1 },
      { name: 'Surendra Mahto', expectedFamily: 1 },
      { name: 'Dilip Kumar Rajak', expectedFamily: 2 },
      { name: 'Sudhakar Kumar', expectedFamily: 4 }
    ];

    console.log("=== CHECKING SPECIFIC MEMBERS FROM JSON DATA ===\n");

    let foundCount = 0;
    let correctCount = 0;

    for (const expected of expectedData) {
      const member = members.find(m => m.name === expected.name);
      
      if (member) {
        foundCount++;
        const isCorrect = member.familyMembersCount === expected.expectedFamily;
        if (isCorrect) correctCount++;
        
        const groupInfo = member.groupMemberships[0]?.group;
        
        console.log(`${isCorrect ? '✅' : '❌'} ${expected.name}:`);
        console.log(`   Expected: ${expected.expectedFamily}, Actual: ${member.familyMembersCount}, Type: ${typeof member.familyMembersCount}`);
        
        if (groupInfo) {
          console.log(`   Group: ${groupInfo.name}`);
          console.log(`   Group Social Enabled: ${groupInfo.groupSocialEnabled}`);
          console.log(`   Amount per Family Member: ₹${groupInfo.groupSocialAmountPerFamilyMember || 0}`);
          
          if (groupInfo.groupSocialEnabled && groupInfo.groupSocialAmountPerFamilyMember) {
            const expectedGS = (member.familyMembersCount || 1) * groupInfo.groupSocialAmountPerFamilyMember;
            console.log(`   Expected Group Social: ₹${expectedGS}`);
          }
        }
        console.log();
      } else {
        console.log(`❌ NOT FOUND: ${expected.name}\n`);
      }
    }

    console.log(`=== SUMMARY ===`);
    console.log(`Members from JSON found in DB: ${foundCount}/${expectedData.length}`);
    console.log(`Members with correct family size: ${correctCount}/${foundCount}`);
    console.log(`Success rate: ${foundCount > 0 ? Math.round((correctCount/foundCount) * 100) : 0}%\n`);

    // Check group social settings
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        groupSocialEnabled: true,
        groupSocialAmountPerFamilyMember: true
      }
    });

    console.log("=== GROUP SOCIAL SETTINGS ===");
    groups.forEach(group => {
      console.log(`Group: ${group.name}`);
      console.log(`  Group Social Enabled: ${group.groupSocialEnabled}`);
      console.log(`  Amount per Family Member: ₹${group.groupSocialAmountPerFamilyMember || 0}`);
    });

    if (correctCount < foundCount) {
      console.log("\n=== ISSUE DETECTED ===");
      console.log("Some members have incorrect family size data.");
      console.log("This indicates the family size data from step 4 of group creation is not being saved properly.");
      
      console.log("\n=== NEXT STEPS ===");
      console.log("1. Check the group creation form debug button in step 4");
      console.log("2. Verify the API submission data includes correct familyMembersCount");
      console.log("3. Check if the database update transaction is working correctly");
    } else {
      console.log("\n✅ Family size data looks correct in the database!");
      console.log("The issue might be in how the data is being retrieved or calculated in the frontend.");
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFamilySizeData();
