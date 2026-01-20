#!/bin/bash

# 🚀 Life Coach App - Vercel Deployment Script
echo "🌟 Deploying Life Coach App to Vercel..."
echo "=========================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm i -g vercel
fi

echo "✅ Vercel CLI ready"

# Navigate to frontend directory
cd frontend

echo "🏗️  Building application..."
npm install
npm run build

echo "🚀 Deploying to production..."
vercel --prod

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================"
echo "✅ Your Life Coach App is now LIVE!"
echo "🌐 Check your URL in the terminal output above"
echo ""
echo "📋 Next steps:"
echo "1. Visit your new app URL"
echo "2. Test all pages and features"
echo "3. Configure environment variables in Vercel dashboard"
echo "4. Set up custom domain (optional)"
echo ""
echo "🌟 Ready to change lives with AI coaching!"