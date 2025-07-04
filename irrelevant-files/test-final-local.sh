#!/bin/bash

echo "🧪 Testing PDF-FINAL endpoint locally..."
echo "📂 Starting test server..."

# Start the dev server in background
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Test the endpoint
echo "📡 Testing PDF-FINAL endpoint..."
PORT=$(lsof -ti:3000 > /dev/null && echo "3001" || echo "3000")
if lsof -ti:3001 > /dev/null; then
  PORT="3002"
fi
echo "🌐 Using port: $PORT"
curl -X POST http://localhost:$PORT/api/pdf-final \
  -F "file=@public/sample-members.pdf" \
  -H "Content-Type: multipart/form-data" \
  > pdf-final-local-test.json

echo "📊 Results:"
node -e "
const fs = require('fs');
try {
  const result = JSON.parse(fs.readFileSync('pdf-final-local-test.json', 'utf8'));
  console.log('✅ Success:', result.success);
  console.log('👥 Members found:', result.members?.length || 0);
  console.log('📄 Pages:', result.totalPages || 0);
  console.log('🔍 Version:', result.version);
  console.log('🚀 Deployment check:', result.deploymentCheck);
  if (result.statistics) {
    console.log('📈 Statistics:', JSON.stringify(result.statistics, null, 2));
  }
  if (result.members && result.members.length > 0) {
    console.log('👤 Sample members:');
    result.members.slice(0, 5).forEach((m, i) => {
      console.log(\`  \${i+1}. \${m.name} - ₹\${m.loanAmount}\`);
    });
  }
} catch (e) {
  console.error('❌ Error parsing response:', e.message);
  console.log('Raw response:', fs.readFileSync('pdf-final-local-test.json', 'utf8').substring(0, 500));
}
"

# Stop the server
kill $SERVER_PID
echo "🏁 Test completed"
