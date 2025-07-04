const { MongoClient } = require('mongodb');

async function testLoanCreation() {
  console.log('Testing loan creation endpoint...');

  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('shg-management');
    
    // Find a group with members
    const groups = await db.collection('Group').find({}).limit(5).toArray();
    console.log(`Found ${groups.length} groups`);
    
    if (groups.length === 0) {
      console.log('No groups found');
      return;
    }
    
    const group = groups[0];
    console.log(`Using group: ${group.name} (${group._id})`);
    
    // Find members in this group
    const members = await db.collection('Member').find({ 
      groupId: group._id.toString() 
    }).toArray();
    
    console.log(`Found ${members.length} members in group`);
    
    if (members.length === 0) {
      console.log('No members found in group');
      return;
    }
    
    const member = members[0];
    console.log(`Using member: ${member.name} (${member._id})`);
    
    // Test the loan creation API
    const loanData = {
      memberId: member._id.toString(),
      loanType: 'PERSONAL',
      originalAmount: 1000,
      interestRate: 12,
      dateIssued: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    console.log('Loan data to send:', JSON.stringify(loanData, null, 2));
    
    const response = await fetch(`http://localhost:3000/api/groups/${group._id}/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loanData)
    });
    
    console.log(`Response status: ${response.status}`);
    const responseText = await response.text();
    console.log('Response:', responseText);
    
    if (!response.ok) {
      console.error('Failed to create loan');
      
      // Try to parse the error
      try {
        const errorData = JSON.parse(responseText);
        console.error('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('Could not parse error response');
      }
    } else {
      console.log('✅ Loan created successfully');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

testLoanCreation();
