#!/bin/bash

# Simple test script to verify Custom Columns feature accessibility
echo "🧪 Custom Columns Feature Test"
echo "================================"

# Check if development server is running
echo "📡 Checking if development server is running..."
if curl -s "http://localhost:3000" > /dev/null; then
    echo "✅ Development server is running on http://localhost:3000"
else
    echo "❌ Development server is not running"
    echo "💡 Run 'npm run dev' to start the server"
    exit 1
fi

# Check if key files exist
echo -e "\n📁 Verifying required files..."
files=(
    "app/components/CustomColumnsManager.tsx"
    "app/components/PDFImport.tsx"
    "app/types/custom-columns.ts"
    "app/api/groups/[id]/custom-schema/route.ts"
)

all_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING"
        all_exist=false
    fi
done

if [ "$all_exist" = true ]; then
    echo -e "\n🎉 All required files are present!"
else
    echo -e "\n❌ Some files are missing"
    exit 1
fi

# Check if CustomColumnsManager is imported in group edit page
echo -e "\n🔍 Checking integration..."
if grep -q "CustomColumnsManager" app/groups/[id]/edit/page.tsx; then
    echo "✅ CustomColumnsManager is integrated in group edit page"
else
    echo "❌ CustomColumnsManager integration not found"
    exit 1
fi

echo -e "\n🎯 Feature Status: READY FOR TESTING"
echo "================================"
echo "🔗 Testing Instructions:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Navigate to Groups → Select any group → Edit"
echo "3. Click 'Advanced Options' → 'Custom Columns & Properties'"
echo "4. Test all features:"
echo "   - Add/Edit columns"
echo "   - Use templates"
echo "   - Try PDF import"
echo "   - Test bulk operations"
echo "   - Save schema changes"
echo ""
echo "✅ Custom Columns Feature is ready for user testing!"
