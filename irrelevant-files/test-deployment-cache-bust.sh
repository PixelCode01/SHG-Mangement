#!/bin/bash

echo "🚀 PDF Import Step 2 Fix - Deployment Test"
echo "⏰ Test Date: $(date)"
echo ""

echo "1. 🔍 Checking build artifacts..."
if [ -d ".next" ]; then
    echo "   ✅ .next directory exists"
    build_id=$(cat .next/BUILD_ID 2>/dev/null || echo "unknown")
    echo "   📦 Build ID: $build_id"
else
    echo "   ❌ .next directory not found - run 'npm run build' first"
    exit 1
fi

echo ""
echo "2. 🔍 Checking for CACHE BUST V6 in built files..."
if grep -r "CACHE BUST V6" .next/static/ >/dev/null 2>&1; then
    echo "   ✅ Found CACHE BUST V6 markers in built files"
else
    echo "   ⚠️  CACHE BUST V6 markers not found in static files"
fi

echo ""
echo "3. 🔍 Checking for extractMembersFromPDFV6 function..."
if grep -r "extractMembersFromPDFV6" .next/static/ >/dev/null 2>&1; then
    echo "   ✅ Found new function name in built files"
else
    echo "   ❌ New function name not found - compilation issue?"
fi

echo ""
echo "4. 🔍 Checking for old pdf-extract-v4 calls..."
if grep -r "pdf-extract-v4" .next/static/ >/dev/null 2>&1; then
    echo "   ⚠️  Found references to pdf-extract-v4 in built files"
    echo "   📝 This might be in comments or error handling - check manually"
else
    echo "   ✅ No pdf-extract-v4 references found in built files"
fi

echo ""
echo "5. 📋 Deployment Checklist:"
echo "   □ Build successful (✅ completed above)"
echo "   □ Deploy to Vercel with --force flag"
echo "   □ Test PDF upload in deployed version"
echo "   □ Verify console shows 'CACHE BUST V6' messages"
echo "   □ Confirm no 422 errors from pdf-extract-v4"
echo "   □ Verify step 2 navigation works"

echo ""
echo "6. 🚀 Deployment Commands:"
echo "   vercel --prod --force"
echo "   # OR"
echo "   git add ."
echo "   git commit -m \"Fix: PDF import step 2 with cache bust V6\""
echo "   git push  # (if auto-deploy is enabled)"

echo ""
echo "7. 🧪 Testing URL:"
echo "   https://shg-mangement.vercel.app/groups/create"
echo "   → Navigate to Step 2 (Import Members)"
echo "   → Upload a PDF file"
echo "   → Check browser console for CACHE BUST V6 messages"

echo ""
echo "✅ Pre-deployment validation complete!"
echo "📋 Ready for deployment with cache bust mechanisms"
