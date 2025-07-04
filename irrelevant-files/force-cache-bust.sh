#!/bin/bash

echo "🚀 FORCE CACHE BUST - VERCEL DEPLOYMENT"
echo "⏰ Timestamp: $(date)"
echo ""

# Delete .next build cache
echo "🗑️  Deleting .next cache..."
rm -rf .next/

# Update package.json timestamp to force rebuild
echo "📦 Updating package.json build timestamp..."
timestamp=$(date +%s)
sed -i.bak "s/\"name\": \"shg-management\"/\"name\": \"shg-management-$timestamp\"/" package.json || true

echo ""
echo "✅ Cache bust complete!"
echo "🔄 Next deployment will be forced to rebuild all components"
echo "⚠️  Users may need to hard refresh (Ctrl+Shift+R) their browsers"
echo ""
echo "🚀 Ready for deployment with cache bust"
echo "📝 Remember to restore package.json after deployment if needed"
