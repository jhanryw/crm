#!/bin/bash
set -e

echo "Starting deployment process..."

# 1. Pull latest changes
echo "Pulling from git..."
git pull origin main

# 2. Build the new Docker image and recreate the container
echo "Building and restarting services via Docker Compose..."
docker-compose down
docker-compose build
docker-compose up -d

# 3. Cleanup unused images and build caches to free up VPS space
echo "Cleaning up dangling Docker images..."
docker image prune -f

echo "Deployment finished successfully!"
