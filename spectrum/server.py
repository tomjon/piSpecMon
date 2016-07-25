from config import *
from common import *
from users import *

from flask import Flask, redirect, url_for, request, send_from_directory, Response, abort
from flask.ext.login import LoginManager, login_user, login_required, current_user, logout_user
from functools import wraps
import requests
import json
import os, os.path
from time import sleep, time, strftime, localtime
import Hamlib
import math
from datetime import datetime
from worker import WorkerInit, WorkerClient
from monitor import get_capabilities, frange


class SecuredStaticFlask (Flask):
  def send_static_file(self, filename):
    if filename == 'login.html' or (current_user is not None and not current_user.is_anonymous() and current_user.is_authenticated()):
      return super(SecuredStaticFlask, self).send_static_file(filename)
    else:
      abort(403)

class User:
  def __init__(self, username, data):
    self.name = username
    self.data = data

  def is_authenticated(self):
    return True

  def is_active(self):
    return True

  def is_anonymous(self):
    return False

  def get_id(self):
    return self.name


def set_settings(id, value):
  data = { 'timestamp': int(time()), 'json': json.dumps(value) }
  r = requests.put(ELASTICSEARCH + 'spectrum/settings/' + id, params={ 'refresh': 'true' }, data=json.dumps(data))
  if r.status_code != 200 and r.status_code != 201:
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

# create index (harmless if it already exists)
with open(local_path('create.json')) as f:
  requests.put('{0}spectrum'.format(ELASTICSEARCH), data=f.read())

application = SecuredStaticFlask(__name__)
application.login_manager = LoginManager()
application.secret_key = 'mordor' #FIXME how to generate, where to keep?
application.caps = get_capabilities()
application.rig = get_settings('rig', { 'model': 1 }) #FIXME is this a Hamlib constant? (dummy rig)
application.worker = WorkerClient(WorkerInit())

# set up secret key for sessions
if not os.path.exists(SECRET_KEY):
  application.secret_key = os.urandom(24)
  with open(SECRET_KEY, 'w') as f:
    f.write(application.secret_key)
else:
  with open(SECRET_KEY) as f:
    application.secret_key = f.read()

# initialise login manager
application.login_manager.init_app(application)

# get default default scan configuration from defaults.json
with open(local_path('defaults.json')) as f:
  application.defaults = get_settings('defaults', json.loads(f.read()))

# Also add log handlers to Flask's logger for cases where Werkzeug isn't used as the underlying WSGI server
application.logger.addHandler(rfh)
application.logger.addHandler(ch)

log.info("{0} rig models".format(len(application.caps['models'])))


@application.route('/', methods=['GET', 'POST'])
def main():
  if current_user is not None and not current_user.is_anonymous() and current_user.is_authenticated():
    return redirect("/static/index.html")
  else:
    return redirect("/static/login.html")


@application.route('/favicon.ico') #FIXME can use send_file, or abolish static/
def favicon():
  return send_from_directory(os.path.join(application.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')


# rig capabilities API
@application.route('/caps')
def caps():
  return json.dumps(application.caps)

# settings API
@application.route('/defaults', methods=['GET', 'PUT'])
@application.route('/rig', methods=['GET', 'PUT'])
@login_required
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
@login_required
def monitor():
  if request.method == 'PUT':
    if 'config_id' in application.worker.status():
      return "Worker already running", 400
    config = json.loads(request.get_data())
    config['rig'] = application.rig
    application.worker.start(json.dumps(config))
    return json.dumps({ 'status': 'OK' })
  if request.method == 'DELETE':
    # stop process
    if 'config_id' not in application.worker.status():
      return "Worker not running", 400
    application.worker.stop()
    return json.dumps({ 'status': 'OK' })
  if request.method == 'GET':
    # monitor status
    return json.dumps(application.worker.status())


# forward Elasticsearch queries verbatim
@application.route('/spectrum/<path:path>', methods=['GET', 'POST', 'DELETE'])
@login_required
def search(path):
  if request.method == 'POST':
    r = requests.post(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args, data=request.get_data())
  elif request.method == 'GET':
    r = requests.get(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args)
  else:
    r = requests.delete(''.join([ELASTICSEARCH + 'spectrum/', path]), params=request.args)
  return r.text, r.status_code


@application.route('/users')
@login_required
def user_list():
  def _namise_data(name, data):
    data['name'] = name
    return data
  users = [_namise_data(name, data) for name, data in iter_users()]
  return json.dumps({ 'data': users })

@application.route('/user/<name>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def user_management(name):
  try:
    if request.method == 'GET':
      data = get_user(name)
      if data is None:
        return "No such user '{0}'".format(name), 404
      data['name'] = name
      return json.dumps({ 'data': data })
    if request.method == 'PUT':
      data = request.get_json()
      if data is None or 'user' not in data is None:
        return "No user data", 400
      if set_user(name, data['user']):
        return json.dumps({ 'status': 'OK' }), 200
      password = data.get('password')
      if password is None:
        return "No password parameter", 400
      create_user(name, password, data['user'])
      return json.dumps({ 'status': 'Created' }), 201
    if request.method == 'DELETE':
      if delete_user(name):
        return json.dumps({ 'status': 'OK' }), 200
      else:
        return "No such user '{0}'".format(name), 404
  except UsersError as e:
    return e.message, 400


@application.login_manager.user_loader
def load_user(username):
  return User(username, get_user(username))

@application.route('/user', methods=['GET', 'POST'])
@login_required
def user_details():
  if request.method == 'GET':
    data = get_user(current_user.name)
    data['name'] = current_user.name
    return json.dumps(data)
  if request.method == 'POST':
    data = request.get_json()
    if 'oldPassword' not in data or 'newPassword' not in data:
      return "Missing password parameter", 400
    try:
      set_password(username, data['oldPassword'], data['newPassword'])
    except IncorrectPasswordError:
      return "Bad password", 403
    return json.dumps({ 'status': 'OK' })


@application.route('/login', methods=['POST'])
def login():
  username = request.form['username']
  password = request.form['password']
  try:
    user = User(username, check_user(username, password))
    login_user(user)
  except IncorrectPasswordError:
    pass
  return redirect('/')

@application.route('/logout')
def logout():
    logout_user()
    return redirect('/')


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
@login_required
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
    return json.dumps({ 'path': path })


@application.route('/stats')
@login_required
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
