const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIResponse() {
  try {
    // Get the group we just created
    const testGroup = await prisma.group.findFirst({
      where: {
        name: 'Test Group with Late Fine Rules'
      },
      select: {
        id: true,
        name: true,
        groupId: true
      }
    });
    
    if (!testGroup) {
      console.log('❌ Test group not found');
      return;
    }
    
    console.log(`Testing API response for group: ${testGroup.name} (${testGroup.id})`);
    
    // Test the API endpoint directly (simulating what happens in group edit)
    const response = await fetch(`http://localhost:3001/api/groups/${testGroup.id}`);
    
    if (response.ok) {
      const groupData = await response.json();
      console.log('✅ API Response received');
      
      // Check if late fine rules are included
      if (groupData.lateFineRules && groupData.lateFineRules.length > 0) {
        console.log('✅ Late fine rules found in API response!');
        const rule = groupData.lateFineRules[0];
        console.log(`   Rule Type: ${rule.ruleType}`);
        console.log(`   Enabled: ${rule.isEnabled}`);
        console.log(`   Tier Rules: ${rule.tierRules ? rule.tierRules.length : 0}`);
        
        if (rule.tierRules) {
          rule.tierRules.forEach((tier, index) => {
            console.log(`     Tier ${index + 1}: Days ${tier.startDay}-${tier.endDay} = ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
          });
        }
        
        // Test the specific fields that the edit form looks for
        console.log(`\n🔍 Edit form compatibility check:`);
        console.log(`   lateFineRules[0].isEnabled: ${rule.isEnabled}`);
        console.log(`   lateFineRules[0].ruleType: ${rule.ruleType}`);
        
        if (rule.isEnabled) {
          console.log('✅ Group edit form should show "Late Fine Enabled"');
        } else {
          console.log('❌ Group edit form would show "Late Fine Not Enabled"');
        }
      } else {
        console.log('❌ No late fine rules found in API response');
        console.log('Available properties:', Object.keys(groupData));
      }
      
    } else {
      console.log(`❌ API call failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIResponse();
