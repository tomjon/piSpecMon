from flask import Flask, redirect, url_for, request, send_from_directory, Response, abort
from functools import wraps
import requests
import json
import os
from threading import Thread, Lock
from monitor import Monitor, get_capabilities, frange
from time import sleep, time, strftime, localtime
from md5 import md5
import Hamlib
import math
from datetime import datetime


ELASTICSEARCH = 'http://localhost:9200/'
POST_STATS = False
EXPORT_DIRECTORY = '/tmp'
USERS_FILE = 'users.passwords'


class SecuredStaticFlask (Flask):
  def send_static_file(self, filename):
    if request.authorization:
      return super(SecuredStaticFlask, self).send_static_file(filename)
    else:
      abort(403)


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

def load_users():
  """ For now, usernames / passwords are stored plain-text
      in a file, one pair per line separated by a tab.
  """
  with open(USERS_FILE) as f:
    return dict(line[:-1].split('\t') for line in f)

def check_auth(username, password):
  """ This function is called to check if a username /
      password combination is valid.
  """
  print "Authenticating user '{0}'".format(username)
  return username in app.users and app.users[username] == password

def authenticate():
  """ Sends a 401 response that enables basic authentication.
  """
  return Response(
    'Could not verify your access level for that URL.\n'
    'You have to login with proper credentials', 401,
    {'WWW-Authenticate': 'Basic realm="Login Required"'})

def requires_auth(f):
  @wraps(f)
  def decorated(*args, **kwargs):
    auth = request.authorization
    if not auth or not check_auth(auth.username, auth.password):
      return authenticate()
    return f(*args, **kwargs)
  return decorated


app = SecuredStaticFlask(__name__)
app.settings = get_settings('global', { 'batch': True })
app.thread = None
app.monitor_lock = Lock()
app.caps = get_capabilities()
app.stats = get_stats()
app.users = load_users()

print "Global settings:", app.settings
print len(app.caps['models']), "rig models"


@app.route('/')
@requires_auth
def main():
  #return 'Login'
  return redirect("/static/index.html")


@app.route('/favicon.ico')
def favicon():
  return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')


# settings API
@app.route('/settings/', methods=['GET', 'PUT'])
@app.route('/settings', methods=['GET', 'PUT'])
@requires_auth
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
@requires_auth
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
        n = 0
        while not self.stop:
          print "Scan:", self.scan
          sweep = { 'config_id': self.config_id, 'n': n, 'timestamp': now(), 'level': [] }
          n += 1

          for x in scan(**self.scan):
            sweep['level'].append(x[1] or -128)
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
@requires_auth
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


# forward Elasticsearch queries verbatim
#FIXME shouldn't do this, really
@app.route('/spectrum/<path:path>', methods=['GET', 'POST', 'DELETE'])
@requires_auth
def search(path):
  if request.method == 'POST':
    r = requests.post(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args, data=request.get_data())
  elif request.method == 'GET':
    r = requests.get(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args)
  else:
    r = requests.delete(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args)
  return r.text, r.status_code


def _iter_export(config, hits):
  yield '#TimeDate,'
  if 'freqs' in config['freqs']:
    yield ','.join(freq['f'] * 10 ** int(freq['exp']) for freq in config['freqs']['freqs'])
  else:
    e = 10 ** int(config['freqs']['exp'])
    yield ','.join(str(f * e) for f in frange(*[float(x) for x in config['freqs']['range']]))
  yield '\n'
  for hit in hits:
    dt = datetime.fromtimestamp(hit['fields']['timestamp'][0] / 1000.0)
    yield str(dt)
    yield ','
    yield ','.join([str(v) if v > -128 else '' for v in hit['fields']['level']])
    yield '\n'

# writes file locally (POST) or stream the output (GET)
@app.route('/export/<config_id>', methods=['GET', 'POST'])
@requires_auth
def export(config_id):
  r = requests.get('%s/spectrum/config/_search?fields=*&q=_id:%s' % (ELASTICSEARCH, config_id))
  if r.status_code != 200:
    return r.text, r.status_code
  hits = r.json()['hits']['hits']
  if len(hits) == 0:
    return 'No such config id', 404
  config = json.loads(hits[0]['fields']['json'][0])
  r = requests.get('%s/spectrum/sweep/_search?size=1000000&sort=timestamp&fields=*&q=config_id:%s' % (ELASTICSEARCH, config_id))
  if r.status_code != 200:
    return r.text, r.status_code
  export = _iter_export(config, r.json()['hits']['hits'])
  if request.method == 'GET':
    return Response(export, mimetype='text/csv')
  else:
    path = '/'.join([EXPORT_DIRECTORY, config_id + '.csv'])
    with open(path, 'w') as f:
      for x in export:
        f.write(x)
    return path


if __name__ == "__main__":
  import sys

  if len(sys.argv) > 1 and sys.argv[1] == 'debug':
    app.debug = True
  app.run(host='0.0.0.0', port=8080)
