// Manually set ACHAL KUMAR OJHA's initial loan amount using direct database access
const { execSync } = require('child_process');

async function setAchalLoanAmount() {
  try {
    console.log('=== SETTING ACHAL KUMAR OJHA LOAN AMOUNT ===');
    
    // Use npx prisma db execute to run raw SQL
    const sqlCommand = `
      UPDATE "GroupMember" 
      SET "initialLoanAmount" = 85702 
      WHERE "name" = 'ACHAL KUMAR OJHA' 
      AND "groupId" = '6838308f181b2206090ad176';
    `;
    
    console.log('Executing SQL command...');
    console.log(sqlCommand);
    
    // Write SQL to a temporary file
    require('fs').writeFileSync('temp-update.sql', sqlCommand);
    
    // Execute the SQL
    const result = execSync('cd /home/pixel/aichat/SHG-Mangement-main && npx prisma db execute --file temp-update.sql', { encoding: 'utf8' });
    
    console.log('✅ SQL executed successfully');
    console.log('Result:', result);
    
    // Clean up temp file
    require('fs').unlinkSync('temp-update.sql');
    
    console.log('\n🔍 Now test the API again to see if it shows ₹85,702');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    // Clean up temp file if it exists
    try {
      require('fs').unlinkSync('temp-update.sql');
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

setAchalLoanAmount();
