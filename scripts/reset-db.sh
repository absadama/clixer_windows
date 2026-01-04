#!/bin/bash

echo "⚠️  This will DELETE all data and reset the database!"
read -p "Are you sure? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd docker
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.dev.yml up -d
    echo "✅ Database reset complete."
fi
