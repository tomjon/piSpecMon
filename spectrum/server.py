from flask import Flask, redirect, url_for, request, send_from_directory, Response, abort
from functools import wraps
import requests
import json
import os
from time import sleep, time, strftime, localtime
from md5 import md5
import Hamlib
import math
from datetime import datetime
import worker
import signal
from monitor import get_capabilities, frange


ELASTICSEARCH = 'http://localhost:9200/'
EXPORT_DIRECTORY = '/tmp'
USERS_FILE = 'users.passwords'


class SecuredStaticFlask (Flask):
  def send_static_file(self, filename):
    if request.authorization:
      return super(SecuredStaticFlask, self).send_static_file(filename)
    else:
      abort(403)


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
app.caps = get_capabilities()
app.users = load_users()

print "Global settings:", app.settings
print len(app.caps['models']), "rig models"


@app.route('/')
@requires_auth
def main():
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


# API: GET /monitor - return process status
#      HEAD /monitor - minimal process status
#      PUT /monitor - start process with supplied config as request body
#      DELETE /monitor - stop process
@app.route('/monitor', methods=['HEAD', 'GET', 'PUT', 'DELETE'])
@requires_auth
def monitor():
  if request.method == 'PUT':
    if worker.status() is not None:
      return "Thread already running", 400
    # start process - start by storing the config set
    #FIXME move this into worker, and really, don't call json.dumps(..get_json())!!!!!
    with open(worker.CONFIG_FILE, 'w') as f:
      f.write(json.dumps(request.get_json()))
    os.kill(app.worker_pid, signal.SIGUSR1)
    return "OK"
  if request.method == 'DELETE':
    # stop process
    if worker.status() is None:
      return "Thread not running", 400
    os.kill(app.worker_pid, signal.SIGUSR1)
    return "OK"
  if request.method == 'GET':
    # monitor status
    return json.dumps(worker.status())


# forward Elasticsearch queries verbatim
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


@app.route('/stats')
def get_stats():
  r = requests.get(ELASTICSEARCH + 'spectrum/_stats/docs,store')
  if r.status_code != 200:
    return None
  stats = r.json()['indices']['spectrum']['primaries']
  return json.dumps({ 'doc_count': stats['docs']['count'], 'size_in_bytes': stats['store']['size_in_bytes'] })


if __name__ == "__main__":
  import sys

  if len(sys.argv) < 2:
    print "Missing worker pid"
    sys.exit(1)
  app.worker_pid = int(sys.argv[1])
  if len(sys.argv) > 2 and sys.argv[2] == 'debug':
    app.debug = True
  app.run(host='0.0.0.0', port=8080)
