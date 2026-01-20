#!/bin/bash

# Life Coach App - Production Deployment Script
# This script will build and deploy your app to production

echo "🚀 Starting Life Coach App Deployment..."
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run type checking
echo "🔍 Running type check..."
npm run typecheck

# Run linting
echo "🧹 Running linting..."
npm run lint

# Build for production
echo "🏗️  Building for production..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not created"
    exit 1
fi

echo "✅ Build successful!"
echo "📁 Build output created in ./dist"

# Preview build (optional)
echo "👀 Would you like to preview the build? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "🚀 Starting preview server..."
    npm run preview
fi

echo ""
echo "🎉 Your Life Coach App is ready for deployment!"
echo "==============================================="
echo "Next steps:"
echo "1. Deploy to Vercel: vercel --prod"
echo "2. Deploy to Netlify: Upload ./dist folder"
echo "3. Deploy to AWS: Upload ./dist to S3 + CloudFront"
echo ""
echo "🌍 Your app will be live and ready to change lives!"