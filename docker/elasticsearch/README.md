# Clixer Elasticsearch Kurulumu

## Genel Bakış

Bu klasör Clixer akıllı arama özelliği için opsiyonel Elasticsearch kurulumunu içerir.

> **Not:** Elasticsearch opsiyoneldir. Arama özelliği PostgreSQL FTS ile de çalışır. Elasticsearch daha hızlı ve gelişmiş arama özellikleri sağlar (fuzzy matching, typo tolerance, autocomplete).

## Gereksinimler

- Docker & Docker Compose
- Minimum 2GB RAM (4GB önerilir)
- Port 9200 (ES REST API)
- Port 9300 (ES Node Communication)
- Port 5601 (Kibana - opsiyonel)

## Kurulum

### 1. Network Oluştur (ilk kez)

```bash
docker network create clixer_default
```

### 2. Elasticsearch Başlat

```bash
# Sadece Elasticsearch
docker-compose -f docker/elasticsearch/docker-compose.es.yml up -d

# Kibana ile birlikte (monitoring)
docker-compose -f docker/elasticsearch/docker-compose.es.yml --profile monitoring up -d
```

### 3. Index Oluştur

```bash
cd docker/elasticsearch
chmod +x setup-es.sh
./setup-es.sh
```

Windows'ta:
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:9200/clixer_search" -Method PUT -ContentType "application/json" -InFile "index-mapping.json"
```

## Durum Kontrolleri

```bash
# Cluster durumu
curl http://localhost:9200/_cluster/health?pretty

# Index bilgisi
curl http://localhost:9200/clixer_search?pretty

# Arama testi
curl "http://localhost:9200/clixer_search/_search?pretty" -H "Content-Type: application/json" -d '{"query":{"match_all":{}}}'
```

## Dosya Yapısı

```
docker/elasticsearch/
├── docker-compose.es.yml  # Docker Compose yapılandırması
├── elasticsearch.yml      # Elasticsearch config
├── index-mapping.json     # Index şeması ve analyzer'lar
├── setup-es.sh           # Kurulum scripti
└── README.md             # Bu dosya
```

## Index Mapping

Index aşağıdaki alanları içerir:

| Alan | Tip | Açıklama |
|------|-----|----------|
| type | keyword | Entity tipi (metric, store, user, vb.) |
| tenant_id | keyword | Tenant ID |
| entity_id | keyword | Orijinal entity ID |
| name | text + keyword + autocomplete + suggest | Ana isim |
| label | text + keyword + autocomplete | Etiket |
| description | text | Açıklama |
| code | keyword + autocomplete | Kod |
| keywords | text | Anahtar kelimeler |
| path | keyword | Navigasyon path'i |
| is_active | boolean | Aktiflik durumu |
| metadata | object | Ek metadata |

## Analyzer'lar

### Turkish Analyzer
Türkçe metin analizi için:
- Stemming (kök bulma)
- Stop words (gereksiz kelimeler)
- Lowercase

### Autocomplete Analyzer
Yazarken öneri için:
- Edge n-gram (2-20 karakter)
- Lowercase

## Performans Ayarları

`elasticsearch.yml` içinde ayarlanabilir:

```yaml
# JVM Heap
ES_JAVA_OPTS=-Xms2g -Xmx2g

# Index buffer
indices.memory.index_buffer_size: 20%

# Query cache
indices.queries.cache.size: 15%
```

## Durdurma

```bash
docker-compose -f docker/elasticsearch/docker-compose.es.yml down

# Verileri de sil
docker-compose -f docker/elasticsearch/docker-compose.es.yml down -v
```

## Entegrasyon

Elasticsearch entegrasyonu için core-service'te search.routes.ts dosyasında ES client kullanılabilir:

```typescript
// Örnek ES sorgusu
const { Client } = require('@elastic/elasticsearch');
const esClient = new Client({ node: 'http://localhost:9200' });

const result = await esClient.search({
  index: 'clixer_search',
  body: {
    query: {
      multi_match: {
        query: searchTerm,
        fields: ['name^3', 'label^2', 'description', 'keywords'],
        fuzziness: 'AUTO'
      }
    }
  }
});
```

## Sorun Giderme

### Elasticsearch başlamıyor
- RAM kontrol: `docker stats`
- Log kontrol: `docker logs clixer-elasticsearch`

### Index oluşturulmuyor
- ES durumu: `curl http://localhost:9200/_cluster/health`
- Mapping hatası: JSON syntax kontrolü

### Yavaş arama
- Shard sayısı: Production için artırılabilir
- Cache ayarları: elasticsearch.yml
