#!/bin/bash
# Clixer Wiki Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Clixer Wiki Deployment Starting..."

# Variables
WIKI_DIR="/opt/clixer-wiki"
REPO_URL="git@github.com:your-org/clixer-wiki.git"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo ./deploy.sh)"
    exit 1
fi

# Create directory if not exists
if [ ! -d "$WIKI_DIR" ]; then
    echo "📁 Creating directory..."
    mkdir -p $WIKI_DIR
fi

# Navigate to directory
cd $WIKI_DIR

# Clone or pull
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building..."
npm run build

# Copy nginx config
echo "⚙️ Configuring Nginx..."
cp nginx.conf /etc/nginx/sites-available/clixer-wiki

# Enable site if not enabled
if [ ! -L "/etc/nginx/sites-enabled/clixer-wiki" ]; then
    ln -s /etc/nginx/sites-available/clixer-wiki /etc/nginx/sites-enabled/
fi

# Test nginx config
nginx -t

# Reload nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Deployment complete!"
echo "🌐 Wiki available at: https://docs.musteri.com"
