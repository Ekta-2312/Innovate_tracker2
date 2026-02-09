#!/bin/bash

# Install backend dependencies
npm install

# Build backend
npm run build

# Install frontend dependencies
cd client
npm install

# Build React app
npm run build

# Go back to root
cd ..

# Create public directory if it doesn't exist
mkdir -p public

# Copy React build to public folder
cp -r client/build/* public/

echo "Build completed successfully!"
