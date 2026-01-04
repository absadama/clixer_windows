#!/bin/bash

echo "🚀 Starting Clixer Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start databases
echo "📦 Starting databases..."
cd docker
docker-compose -f docker-compose.dev.yml up -d

# Wait for databases
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Check health
echo "🔍 Checking database health..."
docker exec clixer_postgres pg_isready -U clixer || echo "PostgreSQL not ready"
curl -s http://localhost:8123/ping && echo "ClickHouse ready" || echo "ClickHouse not ready"
docker exec clixer_redis redis-cli ping || echo "Redis not ready"

echo ""
echo "✅ Databases are running!"
echo ""
echo "📊 Services:"
echo "  PostgreSQL: localhost:5432"
echo "  ClickHouse: localhost:8123"
echo "  Redis: localhost:6379"
echo ""
echo "🔧 Next steps:"
echo "  1. cd shared && npm install && npm run build"
echo "  2. cd gateway && npm install && npm run dev"
echo "  3. cd services/auth-service && npm install && npm run dev"
echo "  4. cd frontend && npm install && npm run dev"
