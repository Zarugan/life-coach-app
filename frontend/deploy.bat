@echo off
REM Life Coach App - Windows Deployment Script
REM This script will build and deploy your app to production

echo 🚀 Starting Life Coach App Deployment...
echo ========================================

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=2 delims=v" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set NODE_MAJOR=%%i
if %NODE_MAJOR% LSS 18 (
    echo ❌ Node.js version 18+ required. Current version: %NODE_VERSION%
    pause
    exit /b 1
)

echo ✅ Node.js version: %NODE_VERSION%

REM Install dependencies
echo 📦 Installing dependencies...
npm ci

REM Run type checking
echo 🔍 Running type check...
npm run typecheck
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Type check failed
    pause
    exit /b 1
)

REM Run linting
echo 🧹 Running linting...
npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Linting failed
    pause
    exit /b 1
)

REM Build for production
echo 🏗️  Building for production...
npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

REM Check if build was successful
if not exist "dist" (
    echo ❌ Build failed - dist directory not created
    pause
    exit /b 1
)

echo ✅ Build successful!
echo 📁 Build output created in .\dist

REM Preview build (optional)
set /p response="👀 Would you like to preview the build? (y/n): "
if /i "%response%"=="y" (
    echo 🚀 Starting preview server...
    npm run preview
)

echo.
echo 🎉 Your Life Coach App is ready for deployment!
echo ===============================================
echo Next steps:
echo 1. Deploy to Vercel: vercel --prod
echo 2. Deploy to Netlify: Upload .\dist folder
echo 3. Deploy to AWS: Upload .\dist to S3 + CloudFront
echo.
echo 🌍 Your app will be live and ready to change lives!
pause