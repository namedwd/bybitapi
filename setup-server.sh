#!/bin/bash

# AWS Lightsail Ubuntu Server Setup Script
# For Bybit Mock Trading Server

echo "========================================="
echo "Starting server setup..."
echo "========================================="

# 1. Update system packages
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install build essentials
echo "Installing build tools..."
sudo apt-get install -y build-essential

# 4. Install Git
echo "Installing Git..."
sudo apt-get install -y git

# 5. Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# 6. Install nginx
echo "Installing Nginx..."
sudo apt-get install -y nginx

# 7. Configure firewall
echo "Configuring firewall..."
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 8080/tcp   # WebSocket
sudo ufw allow 8081/tcp   # API
sudo ufw --force enable

# 8. Create app directory
echo "Creating app directory..."
mkdir -p ~/apps
cd ~/apps

# 9. Clone repository
echo "Cloning repository..."
echo "Please enter your GitHub repository URL:"
read REPO_URL
git clone $REPO_URL bybit-server
cd bybit-server

# 10. Install dependencies
echo "Installing dependencies..."
npm install

# 11. Setup environment file
echo "Setting up environment..."
cp .env.example .env
echo "Please edit .env file with your settings"
echo "Run: nano .env"

echo "========================================="
echo "Basic setup complete!"
echo "Next steps:"
echo "1. Edit .env file: nano ~/apps/bybit-server/.env"
echo "2. Start server: npm start"
echo "3. Or use PM2: pm2 start server-new.js --name bybit-server"
echo "========================================="
