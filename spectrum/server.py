from flask import Flask, redirect, url_for, request, send_from_directory
import requests
import json
import os
from threading import Thread, Lock
from monitor import Monitor, get_capabilities
from time import sleep, time, strftime, localtime
from md5 import md5
import Hamlib
import math


ELASTICSEARCH = 'http://localhost:9200/'
POST_STATS = False


#FIXME: should this be done in the UI?
def convert(d):
  """ Auto-convert empty strings into None, and number strings into numbers.
  """
  for k, v in d.iteritems():
    if v.strip() == '':
      d[k] = None
      continue
    try:
      d[k] = int(v)
    except:
      try:
        d[k] = float(v)
      except:
        pass


def now():
  """ Return time in milliseconds since the epoch.
  """
  return int(time() * 1000)


def set_settings(id, value):
  data = { 'timestamp': int(time()), 'json': json.dumps(value) }
  r = requests.put(ELASTICSEARCH + 'spectrum/settings/' + id, data=json.dumps(data))
  if r.status_code != 201:
    raise Exception("Can not apply settings: %s (%d)" % (id, r.status_code))

def get_settings(id, new={}):
  """ Get the settings by id from Elasticsearch.
  """
  params = { 'fields': 'json' }
  r = requests.get(ELASTICSEARCH + 'spectrum/settings/' + id, params=params)
  if r.status_code == 404:
    print "Initialising settings: " + id
    set_settings(id, new)
    return new
  fields = r.json()['fields']
  return json.loads(fields['json'][0])


def get_stats():
  r = requests.get(ELASTICSEARCH + 'spectrum/_stats/docs,store')
  if r.status_code != 200:
    return None
  stats = r.json()['indices']['spectrum']['primaries']
  return {
    'timestamp': now(),
    'doc_count': stats['docs']['count'],
    'size_in_bytes': stats['store']['size_in_bytes']
  }

def post_stats():
  r = requests.post(ELASTICSEARCH + 'spectrum/stats/', data=json.dumps(app.stats))
  if r.status_code != 201:
    print "** FAILED TO POST STATS"


app = Flask(__name__)
app.settings = get_settings('global', { 'batch': True })
app.thread = None
app.monitor_lock = Lock()
app.caps = get_capabilities()
app.stats = get_stats()

print "Global settings:", app.settings
print len(app.caps['models']), "rig models"


@app.route('/')
def main():
  return send_from_directory(os.path.join(app.root_path, 'static'),
                             'index.html', mimetype='text/html')

@app.route('/favicon.ico')
def favicon():
  return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')


# settings API
@app.route('/settings/', methods=['GET', 'PUT'])
@app.route('/settings', methods=['GET', 'PUT'])
def setting():
  if request.method == 'GET':
    return json.dumps(app.settings)
  elif request.method == 'PUT':
    set_settings('global', request.get_json())
    return 'OK'


# rig capabilities API
@app.route('/rig')
def rig():
  return json.dumps(app.caps)


@app.route('/stats')
def stats():
  if app.stats is None:
    return "Stats not found", 404
  return json.dumps(app.stats)


class Collector (Thread):

  def __init__(self, config_id, config, timestamp):
    Thread.__init__(self)

    self.config_id = config_id
    self.t0 = timestamp

    convert(config['rig'])
    convert(config['scan'])

    # rig settings
    self.rig_config = config['rig']
    self.period = getattr(config, "period", 1.0)

    # scan settings
    self.scan = config['scan']
    for x in config['freqs']:
      # x is either 'range' or 'freqs'
      if x == 'range':
        exp = int(config['freqs']['exp'])
        self.scan[x] = [ 10 ** exp * float(f) for f in config['freqs'][x] ]
      elif x == 'freqs':
        self.scan[x] = [ 10 ** int(f['exp']) * float(f['f']) for f in config['freqs'][x] ]
      else:
        raise ValueError("Bad key in config.freqs")
      break
    else:
      raise ValueError("No frequencies in config")

    self.stop = False
    self.timestamp = None

  def run(self):
    try:
      with Monitor(**self.rig_config) as scan:
        while not self.stop:
          print "Scan:", self.scan
          sweep = { 'config_id': self.config_id, 'timestamp': now(), 'level': [] }
          for x in scan(**self.scan):
            sweep['level'].append(x[1])
          data = json.dumps(sweep)
          r = requests.post(ELASTICSEARCH + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=data)
          if r.status_code != 201:
            print "***", r.status_code
            self.stop = True
          app.stats = get_stats()
          if POST_STATS:
            post_stats()
          sleep(self.period)
    except Exception as e:
      print e
      # store the error and FIXME check the result
      data = { 'timestamp': now(), 'config_id': self.config_id, 'json': json.dumps(str(e)) }
      params = { 'parent': self.config_id, 'refresh': 'true' }
      requests.post(ELASTICSEARCH + 'spectrum/error/', params=params, data=json.dumps(data))
    finally:
      app.thread = None


# API: GET /monitor - return process status
#      HEAD /monitor - minimal process status
#      PUT /monitor - start process with supplied config as request body
#      DELETE /monitor - stop process
@app.route('/monitor', methods=['HEAD', 'GET', 'PUT', 'DELETE'])
def monitor():
  with app.monitor_lock:
    if request.method == 'PUT':
      if app.thread is not None:
        #FIXME or should this be idempotent?
        return "Thread already running", 400
      # start process - start by storing the config set
      config = request.get_json()
      data = { 'timestamp': now(), 'json': json.dumps(config) }
      r = requests.post(ELASTICSEARCH + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
      if r.status_code != 201:
        print "Can not post config:", r.status_code, config
        return 'Can not post config', r.status_code
      config_id = r.json()['_id']
      app.thread = Collector(config_id, config, data['timestamp'])
      app.thread.start()
      return "OK"
    if request.method == 'DELETE':
      # stop process
      if app.thread is None:
        #FIXME or silently OK?
        return "Thread not running", 400
      app.thread.stop = True
      return "OK"
    if request.method == 'HEAD':
      # available for minimal status enquiries
      if app.thread is None:
        return "Not found", 404
      return "OK"
    if request.method == 'GET':
      # process status
      if app.thread is None:
        return "Not found", 404
      return json.dumps({ 'config_id': app.thread.config_id, 'last_sweep': app.thread.timestamp })


@app.route('/spectrum/<path:path>', methods=['GET', 'POST'])
def search(path):
  if request.method == 'GET':
    r = requests.get(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args)
  else:
    r = requests.post(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args, data=request.get_data())
  return r.text, r.status_code



if __name__ == "__main__":
  import sys

  if len(sys.argv) > 1 and sys.argv[1] == 'debug':
    app.debug = True
  app.run(host='0.0.0.0', port=8080)
