from config import *
from common import *

from flask import Flask, redirect, url_for, request, send_from_directory, Response, abort
from functools import wraps
import requests
import json
import os
from time import sleep, time, strftime, localtime
import Hamlib
import math
from datetime import datetime
from worker import WorkerInit, WorkerClient
from monitor import get_capabilities, frange


class SecuredStaticFlask (Flask):
  def send_static_file(self, filename):
    if request.authorization:
      return super(SecuredStaticFlask, self).send_static_file(filename)
    else:
      abort(403)


def set_settings(id, value):
  data = { 'timestamp': int(time()), 'json': json.dumps(value) }
  r = requests.put(ELASTICSEARCH + 'spectrum/settings/' + id, params={ 'refresh': 'true' }, data=json.dumps(data))
  if r.status_code != 200:
    raise Exception("Can not apply settings: %s (%d)" % (id, r.status_code))
  return value

def get_settings(id, new={}):
  """ Get the settings by id from Elasticsearch.
  """
  params = { 'fields': 'json' }
  r = requests.get(ELASTICSEARCH + 'spectrum/settings/' + id, params=params)
  if r.status_code == 404 or not r.json()['found']:
    log.info("Initialising settings: {0}".format(id))
    set_settings(id, new)
    return new
  fields = r.json()['fields']
  return json.loads(fields['json'][0])


def load_users():
  """ For now, usernames / passwords are stored plain-text
      in a file, one pair per line separated by a tab.
  """
  with open(local_path(USERS_FILE)) as f:
    return dict(line[:-1].split('\t') for line in f)

def check_auth(username, password):
  """ This function is called to check if a username /
      password combination is valid.
  """
  return username in application.users and application.users[username] == password

def authenticate():
  """ Sends a 401 response that enables basic authentication.
  """
  message = 'Could not verify your access level for that URL'
  return Response(message, 401, {'WWW-Authenticate': 'Basic realm="Login Required"'})

def requires_auth(f):
  @wraps(f)
  def decorated(*args, **kwargs):
    auth = request.authorization
    if not auth or not check_auth(auth.username, auth.password):
      return authenticate()
    return f(*args, **kwargs)
  return decorated

# create index (harmless if it already exists)
with open(local_path('create.json')) as f:
  requests.put('{0}spectrum'.format(ELASTICSEARCH), data=f.read())


application = SecuredStaticFlask(__name__)
application.settings = get_settings('settings', { 'batch': True })
application.caps = get_capabilities()
application.rig = get_settings('rig', { 'model': 1 }) #FIXME is this a Hamlib constant? (dummy rig)
application.users = load_users()
application.worker = WorkerClient(WorkerInit())

# Also add log handlers to Flask's logger for cases where Werkzeug isn't used as the underlying WSGI server
application.logger.addHandler(rfh)
application.logger.addHandler(ch)

log.info("Global settings: {0}".format(application.settings))
log.info("{0} rig models".format(len(application.caps['models'])))


@application.route('/')
@requires_auth
def main():
  return redirect("/static/index.html")


@application.route('/favicon.ico')
def favicon():
  return send_from_directory(os.path.join(application.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')


# rig capabilities API
@application.route('/caps')
def caps():
  return json.dumps(application.caps)

# settings API
@application.route('/settings', methods=['GET', 'PUT'])
@application.route('/rig', methods=['GET', 'PUT'])
@requires_auth
def settings():
  rule = request.url_rule.rule[1:]
  if request.method == 'GET':
    return json.dumps(getattr(application, rule))
  elif request.method == 'PUT':
    setattr(application, rule, set_settings(rule, request.get_json()))
    return 'OK'


# API: GET /monitor - return process status
#      HEAD /monitor - minimal process status
#      PUT /monitor - start process with supplied config as request body
#      DELETE /monitor - stop process
@application.route('/monitor', methods=['HEAD', 'GET', 'PUT', 'DELETE'])
@requires_auth
def monitor():
  if request.method == 'PUT':
    if 'config_id' in application.worker.status():
      return "Worker already running", 400
    config = json.loads(request.get_data())
    config['rig'] = application.rig
    application.worker.start(json.dumps(config))
    return "OK"
  if request.method == 'DELETE':
    # stop process
    if 'config_id' not in application.worker.status():
      return "Worker not running", 400
    application.worker.stop()
    return "OK"
  if request.method == 'GET':
    # monitor status
    return json.dumps(application.worker.status())


# forward Elasticsearch queries verbatim
@application.route('/spectrum/<path:path>', methods=['GET', 'POST', 'DELETE'])
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
@application.route('/export/<config_id>', methods=['GET', 'POST'])
@requires_auth
def export(config_id):
  config = get_config(config_id)
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


@application.route('/stats')
def get_stats():
  r = requests.get(ELASTICSEARCH + 'spectrum/_stats/docs,store')
  if r.status_code != 200:
    return None
  stats = r.json()['indices']['spectrum']['primaries']
  return json.dumps({ 'doc_count': stats['docs']['count'], 'size_in_bytes': stats['store']['size_in_bytes'] })


if __name__ == "__main__":
  import sys

  if 'debug' in sys.argv:
    application.debug = True
  application.run(host='0.0.0.0', port=8080)
