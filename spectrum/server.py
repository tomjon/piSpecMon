from flask import Flask, redirect, url_for, request, send_from_directory
import requests
import json
import os
from pypath import PyPath
from threading import Thread, Lock
from monitor import Monitor, get_capabilities
from time import sleep, time
from md5 import md5
import Hamlib
import math

ELASTICSEARCH = 'http://localhost:9200/'
BATCH = True

app = Flask(__name__)
app.settings = { }
app.thread = None
app.monitor_lock = Lock()
app.caps = get_capabilities()

@app.route('/')
def main():
  return send_from_directory(os.path.join(app.root_path, 'static'),
                             'index.html', mimetype='text/html')

@app.route('/favicon.ico')
def favicon():
  return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')


# settings API
@app.route('/settings/', methods=['GET', 'PUT', 'DELETE'])
@app.route('/settings', methods=['GET', 'PUT', 'DELETE'])
@app.route('/settings/<path:path>', methods=['GET', 'PUT', 'DELETE'])
def setting(path=''):
  if path == '' and request.method == 'DELETE':
    app.settings = {}
    return 'OK'
  try:
    node = PyPath(path)(app.settings)
  except ValueError as e:
    return 'Bad path: %s' % e, 400
  if request.method == 'GET':
    x = node.get()
    return json.dumps(x) if x is not None else ('Not found', 404)
  elif request.method == 'PUT':
    node.set(request.get_json() or request.get_data())
    return 'OK'
  else:
    node.delete()
    return 'OK'


# rig capabilities API
@app.route('/rig')
def rig():
  return json.dumps(app.caps)


#FIXME: should this be done in the UI?
def convert(d):
  # auto-convert number strings into numbers
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


class Collector (Thread):

  def __init__(self, config_id, config):
    Thread.__init__(self)
    self.config_id = config_id
    self.error = None

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
          self.timestamp = int(time() * 1000)
          index = 0
          bulk = []
          print "**", self.scan
          for x in scan(**self.scan):
            json1 = { 'index': { '_index': 'spectrum', '_type': 'signal' } }
            json2 = { 'config_id': self.config_id, 'timestamp': self.timestamp, 'index': index, 'level': x[1] }
            data = '%s\n%s\n' % (json.dumps(json1), json.dumps(json2))
            if not BATCH:
              self._post_es(data)
            else:
              bulk.append(data)
            index += 1
          if BATCH:
            self._post_es(''.join(bulk))
          sleep(self.period)
    except Exception as e:
      print e
      # store the error and FIXME check the result
      data = { 'timestamp': int(time() * 1000), 'config_id': self.config_id, 'message': str(e) }
      params = { 'parent': self.config_id, 'refresh': 'true' }
      requests.post(ELASTICSEARCH + 'spectrum/error/', params=params, data=json.dumps(data))
    finally:
      app.thread = None

  def _post_es(self, data):
    r = requests.post(ELASTICSEARCH + '_bulk', params={ 'refresh': 'true' }, data=data)
    if r.status_code != 200:
      print "***", r.status_code
      self.stop = True


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
      data = { 'timestamp': int(time() * 1000), 'config': json.dumps(config) }
      r = requests.post(ELASTICSEARCH + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
      if r.status_code != 201:
        return 'Bad update', r.status_code
      config_id = r.json()['_id']
      app.thread = Collector(config_id, config)
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
