#!/bin/bash

echo "🛑 Stopping Clixer Development Environment..."

cd docker
docker-compose -f docker-compose.dev.yml down

echo "✅ All services stopped."
