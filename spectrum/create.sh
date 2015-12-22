curl -XPUT 'http://localhost:9200/spectrum' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "sequence": {
      "_source": { "enabled": false },
      "_all": { "enabled": false },
      "_timestamp": { "enabled": false },
      "enabled": false
    },
    "config": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "timestamp": { "type": "long", "store": true },
        "config": { "type": "string", "store": true, "index": "no" }
      }
    },
    "signal": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "config_id": { "type": "integer", "store": true },
        "offset": { "type": "integer", "store": true },
        "index": { "type": "short", "store": true },
        "level": { "type": "byte", "store": true }
      }
    },
    "error": {
      "_all": { "enabled": false },
      "_source": { "enabled": false },
      "_timestamp": { "enabled": false },
      "properties": {
        "config_id": { "type": "integer", "store": true },
        "timestamp": { "type": "long", "store": true },
        "nessage": { "type": "string", "store": true, "index": "not_analyzed" }
      }
    }
  }
}'; echo
