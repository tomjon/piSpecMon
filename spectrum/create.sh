curl -XPUT 'http://localhost:9200/spectrum' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "settings": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "timestamp": { "type": "long", "store": true },
        "json": { "type": "string", "store": true, "index": "no" }
      }
    },
    "config": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "timestamp": { "type": "long", "store": true },
        "json": { "type": "string", "store": true, "index": "no" }
      }
    },
    "signal": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "conf_id": { "type": "string", "store": false, "index": "not_analyzed" },
        "time": { "type": "long", "store": false },
        "index": { "type": "short", "store": false },
        "level": { "type": "byte", "store": false }
      }
    },
    "error": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "config_id": { "type": "string", "store": true },
        "timestamp": { "type": "long", "store": true },
        "json": { "type": "string", "store": true, "index": "no" }
      }
    },
    "stats": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "timestamp": { "type": "long", "store": true },
        "doc_count": { "type": "integer", "store": true, "index": "no" },
        "size_in_bytes": { "type": "integer", "store": true, "index": "no" }
      }
    }
  }
}'; echo
