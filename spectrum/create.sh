curl -XPUT 'http://127.0.0.1:9200/spectrum' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "max_result_window": 1000000
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
    "sweep": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "config_id": { "type": "string", "store": true, "index": "not_analyzed" },
        "n": { "type": "integer", "store": true, "index": "no" },
        "timestamp": { "type": "long", "store": true },
        "level": { "type": "byte", "store": true, "index": "no" },
        "totaltime": { "type": "long", "store": true, "index": "no" }
      }
    },
    "error": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "config_id": { "type": "string", "store": true, "index": "not_analyzed" },
        "timestamp": { "type": "long", "store": true },
        "json": { "type": "string", "store": true, "index": "no" }
      }
    }
  }
}'; echo
