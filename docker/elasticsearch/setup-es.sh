#!/bin/bash
# Clixer - Elasticsearch Setup Script
# Bu script Elasticsearch'ü kurar ve index'i oluşturur

set -e

ES_HOST="${ES_HOST:-http://localhost:9200}"
INDEX_NAME="${INDEX_NAME:-clixer_search}"

echo "🔍 Clixer Elasticsearch Setup"
echo "=============================="

# Wait for Elasticsearch to be ready
echo "⏳ Elasticsearch'ün hazır olması bekleniyor..."
for i in {1..30}; do
    if curl -s "$ES_HOST/_cluster/health" > /dev/null 2>&1; then
        echo "✅ Elasticsearch hazır!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Elasticsearch'e bağlanılamadı!"
        exit 1
    fi
    echo "  Bekleniyor... ($i/30)"
    sleep 2
done

# Check cluster health
echo ""
echo "📊 Cluster durumu:"
curl -s "$ES_HOST/_cluster/health?pretty"

# Delete existing index if exists
echo ""
echo "🗑️  Mevcut index siliniyor (varsa)..."
curl -s -X DELETE "$ES_HOST/$INDEX_NAME" > /dev/null 2>&1 || true

# Create index with mapping
echo ""
echo "📝 Index oluşturuluyor: $INDEX_NAME"
curl -s -X PUT "$ES_HOST/$INDEX_NAME" \
    -H "Content-Type: application/json" \
    -d @index-mapping.json | jq .

# Verify index
echo ""
echo "✅ Index oluşturuldu:"
curl -s "$ES_HOST/$INDEX_NAME/_mapping?pretty" | head -20

echo ""
echo "=============================="
echo "🎉 Elasticsearch kurulumu tamamlandı!"
echo ""
echo "Kullanım:"
echo "  - REST API: $ES_HOST"
echo "  - Index: $INDEX_NAME"
echo "  - Kibana (opsiyonel): http://localhost:5601"
echo ""
echo "Test:"
echo "  curl $ES_HOST/$INDEX_NAME/_search?pretty"
