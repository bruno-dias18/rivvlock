#!/bin/bash

# 📦 Bundle Analysis Script
# Usage: ./scripts/analyze-bundle.sh

echo "🔍 Analyzing bundle size and performance..."
echo ""

# Build the project
echo "📦 Building production bundle..."
npm run build

echo ""
echo "✅ Build complete!"
echo ""

# Calculate bundle sizes
echo "📊 Bundle Size Analysis:"
echo "======================="
echo ""

# Total dist size
TOTAL_SIZE=$(du -sh dist | cut -f1)
echo "Total dist/ size: $TOTAL_SIZE"

# Assets size
ASSETS_SIZE=$(du -sh dist/assets | cut -f1)
echo "Assets size: $ASSETS_SIZE"

# Individual chunk sizes
echo ""
echo "Top 10 largest chunks:"
echo "----------------------"
du -h dist/assets/*.js | sort -rh | head -10

echo ""
echo "📈 Compression Analysis:"
echo "======================="

# Find largest JS file
LARGEST_JS=$(ls -S dist/assets/*.js | head -1)

if [ -f "$LARGEST_JS" ]; then
  ORIGINAL_SIZE=$(wc -c < "$LARGEST_JS" | awk '{print $1/1024 " KB"}')
  GZIP_SIZE=$(gzip -c "$LARGEST_JS" | wc -c | awk '{print $1/1024 " KB"}')
  
  echo "Largest file: $(basename "$LARGEST_JS")"
  echo "Original: $ORIGINAL_SIZE"
  echo "Gzipped: $GZIP_SIZE"
fi

echo ""
echo "🎯 Performance Targets:"
echo "======================"
echo "✓ Initial bundle: < 200KB"
echo "✓ Gzipped: < 85KB"
echo "✓ Total assets: < 2MB"

echo ""
echo "💡 Next steps:"
echo "1. Run 'npm run preview' to test locally"
echo "2. Run lighthouse audit: npx lighthouse http://localhost:4173 --view"
echo "3. Check bundle visualizer: npx vite-bundle-visualizer"

echo ""
echo "✅ Analysis complete!"
