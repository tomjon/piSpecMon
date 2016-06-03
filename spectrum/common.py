from config import *
import requests
import json

def get_config(config_id):
  r = requests.get('%s/spectrum/config/_search?fields=*&q=_id:%s' % (ELASTICSEARCH, config_id))
  if r.status_code != 200:
    return r.text, r.status_code
  hits = r.json()['hits']['hits']
  if len(hits) == 0:
    return 'No such config id', 404
  return json.loads(hits[0]['fields']['json'][0])
