#!/bin/bash
echo "🔍 Checking Vercel deployment status..."
echo "Timestamp: $(date)"

# Test the deployed endpoint
RESULT=$(curl -s https://shg-mangement.vercel.app/api/pdf-parse-universal -X POST -F "file=@/home/pixel/Downloads/members.pdf" | grep -o '"totalMembers":[0-9]*' | cut -d':' -f2)

if [ "$RESULT" = "0" ]; then
    echo "❌ Deployment not ready yet - still returning 0 members"
    echo "   Please wait a few more minutes and try again"
elif [ -n "$RESULT" ] && [ "$RESULT" -gt "0" ]; then
    echo "✅ Deployment successful! Extracting $RESULT members"
    echo "   🎉 PDF extraction is now working on the deployed version!"
else
    echo "⚠️  Deployment status unclear - please test manually"
fi

echo ""
echo "To test: Upload the PDF file in your browser at:"
echo "https://shg-mangement.vercel.app"
