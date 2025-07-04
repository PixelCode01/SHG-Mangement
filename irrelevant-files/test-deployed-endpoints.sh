#!/bin/bash

echo "🧪 Testing DEPLOYED PDF endpoints..."

echo "📡 Testing pdf-final endpoint (should work)..."
echo '{
  "endpoint": "/api/pdf-final",
  "status": "testing",
  "timestamp": "'$(date)'"
}' > /tmp/test.json

# Test with a small file upload
echo "📄 Creating small test file..."
echo -e "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF" > /tmp/test.pdf

echo "🌐 Testing deployed endpoint with simple PDF..."
STATUS=$(curl -w "%{http_code}" -s -o /tmp/response.json \
  -X POST https://shg-mangement.vercel.app/api/pdf-final \
  -F "file=@/tmp/test.pdf" \
  -H "Content-Type: multipart/form-data")

echo "📊 Response Status: $STATUS"
echo "📄 Response:"
cat /tmp/response.json | jq . 2>/dev/null || cat /tmp/response.json

echo ""
echo "🧪 Testing older working endpoint for comparison..."
STATUS2=$(curl -w "%{http_code}" -s -o /tmp/response2.json \
  -X POST https://shg-mangement.vercel.app/api/pdf-parse-universal \
  -F "file=@/tmp/test.pdf" \
  -H "Content-Type: multipart/form-data")

echo "📊 Response Status: $STATUS2"
echo "📄 Response:"
cat /tmp/response2.json | jq . 2>/dev/null || cat /tmp/response2.json

# Clean up
rm -f /tmp/test.json /tmp/test.pdf /tmp/response.json /tmp/response2.json
