from config import *
from common import *
from users import *

from flask import Flask, current_app, redirect, url_for, request, send_from_directory, Response, abort, send_file
from flask_login import LoginManager, login_user, login_required, current_user, logout_user
from functools import wraps
import requests
import json
import os, os.path
import shutil
from time import sleep, time, strftime, localtime
import Hamlib
import math
from datetime import datetime
from worker import Worker
from monkey import Monkey
from monitor import get_capabilities
import fs_datastore as data_store
import re
import mimetypes


class SecuredStaticFlask (Flask):
  def send_static_file(self, filename):
    if filename == 'login.html' or (current_user is not None and not current_user.is_anonymous and current_user.is_authenticated):
      return super(SecuredStaticFlask, self).send_static_file(filename)
    else:
      return redirect('/')

def send_file_partial(path):
  """ See http://blog.asgaard.co.uk/2012/08/03/http-206-partial-content-for-flask-python
      
      We need this for supprting media files with Safari (at least).
  """
  range_header = request.headers.get('Range', None)
  if not range_header: return send_file(path)

  byte1, byte2 = 0, None
  
  m = re.search('(\d+)-(\d*)', range_header)
  g = m.groups()
  
  if g[0]: byte1 = int(g[0])
  if g[1]: byte2 = int(g[1])

  if byte2 is None: return send_file(path)

  path = os.path.join(current_app.root_path, path)
  size = os.path.getsize(path)    

  length = size - byte1 + 1
  if byte2 is not None:
    length = byte2 - byte1 + 1
  
  data = None
  with open(path, 'rb') as f:
    f.seek(byte1)
    data = f.read(length)

  rv = Response(data, 206, mimetype=mimetypes.guess_type(path)[0], direct_passthrough=True)
  rv.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(byte1, byte1 + length - 1, size))
  return rv


class User:
  def __init__(self, username, data):
    self.name = username
    self.data = data
    self.is_authenticated = True
    self.is_active = True
    self.is_anonymous = False

  def get_id(self):
    return self.name


def role_required(roles):
  def role_decorator(func):
    @wraps(func)
    def decorated_view(*args, **kwargs):
      if hasattr(current_user, 'name'):
        application.request_times[current_user.name] = time()
      if hasattr(current_user, 'data') and current_user.data['role'] in roles:
        return login_required(func)(*args, **kwargs)
      return application.login_manager.unauthorized()
    return decorated_view
  return role_decorator

def check_user_timeout():
  # check for user timeouts
  for name in application.logged_in_users:
    if not application.debug and time() > application.request_times[name] + USER_TIMEOUT_SECS:
      application.logged_in_users.remove(name)
  # check whether current user has been logged out?
  if not hasattr(current_user, 'name'):
    return None
  if current_user.name not in application.logged_in_users:
    logout_user()
    return "User session timed out", 403
  return None


application = SecuredStaticFlask(__name__)
application.login_manager = LoginManager()
application.logged_in_users = []
application.request_times = {}
application.before_request(check_user_timeout)
application.caps = get_capabilities()
application.rig = data_store.Settings('rig').read({'model': Hamlib.RIG_MODEL_PSMTEST})
application.audio = data_store.Settings('audio').read({'path': '/dev/dsp1', 'rate': 44100, 'period': 600, 'duration': 10, 'threshold': -20})
application.rds = data_store.Settings('rds').read({'device': '/dev/ttyACM0', 'strength_threshold': 40, 'strength_timeout': 20, 'rds_timeout': 300})
application.defaults = data_store.Settings('defaults').read({"freqs": {"range": [87.5, 108.0, 0.1], "exp": 6}, "monitor": {"period": 0, "radio_on": 1}, "scan": {"mode": 64}})
application.worker = Worker().client()
application.monkey = Monkey().client()

@application.after_request
def after_request(response):
  response.headers.add('Accept-Ranges', 'bytes')
  return response

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

# Also add log handlers to Flask's logger for cases where Werkzeug isn't used as the underlying WSGI server
application.logger.addHandler(rfh)
application.logger.addHandler(ch)

log.info("{0} rig models".format(len(application.caps['models'])))


@application.route('/', methods=['GET', 'POST'])
def main():
  if current_user is not None and not current_user.is_anonymous and current_user.is_authenticated:
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
@application.route('/audio', methods=['GET', 'PUT'])
@application.route('/rds', methods=['GET', 'PUT'])
@role_required(['admin'])
def settings():
  rule = request.url_rule.rule[1:]
  if request.method == 'GET':
    return json.dumps(getattr(application, rule).values)
  elif request.method == 'PUT':
    getattr(application, rule).write(request.get_json())
    return json.dumps({ 'status': 'OK' })


# API: GET /monitor - return process status
#      PUT /monitor - start process with supplied config as request body
#      DELETE /monitor - stop process
@application.route('/monitor', methods=['GET', 'PUT', 'DELETE'])
@role_required(['admin', 'freq', 'data'])
def monitor():
  if request.method == 'PUT':
    if 'config_id' in application.worker.status():
      return "Worker already running", 400
    values = json.loads(request.get_data())
    values['rig'] = application.rig.values
    values['audio'] = application.audio.values
    values['rds'] = application.rds.values

    try:
      config = data_store.Config().write(now(), values)
    except StoreError as e:
      return e.message, 500

    application.worker.start(config.id)
    if config.values['scan']['rds'] == 'true':
      application.monkey.start(config.id)

    return json.dumps({ 'status': 'OK' })
  if request.method == 'DELETE':
    # stop process
    if 'config_id' not in application.worker.status():
      return "Worker not running", 400
    application.worker.stop()
    application.monkey.stop()
    return json.dumps({ 'status': 'OK' })
  if request.method == 'GET':
    # monitor status
    return json.dumps({ 'worker': application.worker.status(), 'monkey': application.monkey.status() })

def _config_dict(x):
  return {'id': x.id, 'timestamp': x.timestamp, 'values': x.values, 'first': x.first, 'latest': x.latest, 'count': x.count}

@application.route('/config')
@role_required(['admin', 'freq', 'data'])
def configs():
  try:
    return json.dumps({ 'data': [_config_dict(x) for x in data_store.Config.iter()]})
  except StoreError as e:
    return e.message, 500

# FIXME noone should be able to delete the running sweep
@application.route('/config/<config_id>', methods=['GET', 'DELETE'])
@role_required(['admin'])
def config(config_id):
  if request.method == 'GET':
    try:
      return json.dumps(_config_dict(data_store.Config(config_id).read()))
    except StoreError as e:
      return e.message, 500
  else:
    # delete audio samples...
    samples_path = os.path.join(current_app.root_path, SAMPLES_DIRECTORY, config_id)
    if os.path.isdir(samples_path):
      shutil.rmtree(samples_path)
    # delete spectrum and RDS data
    try:
      data_store.Config(config_id).delete()
    except StoreError as e:
      return e.message, 500
    return json.dumps({ 'status': 'OK' })

def _int_arg(name):
  x = request.args.get(name)
  return None if x is None else int(x)

@application.route('/data/<config_id>')
@role_required(['admin', 'freq', 'data'])
def data(config_id):
  range = (_int_arg('start'), _int_arg('end'))
  try:
    config = data_store.Config(config_id).read()
    data = {}
    data['spectrum'] = list(config.iter_spectrum(*range))
    data['audio'] = list(config.iter_audio(*range))
    data['rds'] = {
      'name': list(config.iter_rds_name(*range)),
      'text': list(config.iter_rds_text(*range))
    }
    return json.dumps(data)
  except StoreError as e:
    return e.message, 500

@application.route('/audio/<config_id>/<freq_n>/<timestamp>')
@role_required(['admin', 'freq', 'data'])
def audio_stream(config_id, freq_n, timestamp):
  if '.' in config_id or '/' in config_id or '\\' in config_id:
    return 'Bad parameter', 400
  try:
    int(timestamp), int(freq_n)
  except ValueError:
    return 'Bad parameter', 400
  base = data_store.Config(config_id).audio_path(timestamp, freq_n)
  for ext in ['mp3', 'ogg', 'wav']:
    path = '{0}.{1}'.format(base, ext)
    try:
      return send_file_partial(path)
    except IOError:
      pass
  return 'File not found', 404

@application.route('/users')
@role_required([ 'admin' ])
def user_list():
  def _namise_data(name, data):
    data['name'] = name
    if name in application.logged_in_users:
      data['logged_in'] = True
    if name in application.request_times:
      data['last_request'] = application.request_times[name]
    return data
  users = [_namise_data(name, data) for name, data in iter_users()]
  return json.dumps({ 'data': users })

@application.route('/user/<name>', methods=['GET', 'PUT', 'DELETE'])
@role_required(['admin'])
def user_management(name):
  try:
    if request.method == 'GET':
      data = get_user(name)
      if data is None:
        return "No such user '{0}'".format(name), 404
      data['name'] = name
      if name in application.logged_in_users:
        data['logged_in'] = True
      return json.dumps({ 'data': data })
    if request.method == 'PUT':
      if name in application.logged_in_users:
        return "User is logged in", 400
      data = request.get_json()
      if data is None or 'user' not in data:
        return "No user data", 400
      if set_user(name, data['user']):
        return json.dumps({ 'status': 'OK' }), 200
      password = data_store.get('password')
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
def load_user(username, password=None):
  if password is not None:
    user = User(username, check_user(username, password))
  else:
    if username not in application.logged_in_users:
      return None # log out this user, who was logged in before server restart
    user = User(username, get_user(username))
  if user.data['role'] != 'data':
    for name in application.logged_in_users:
      if name == user.name:
        break
      data = get_user(name)
      if data['role'] != 'data':
        user.data['role'] = 'data'
        user.data['superior'] = data
        break
  return user

@application.route('/user', methods=['GET', 'POST'])
@role_required(['admin', 'freq', 'data'])
def user_details():
  """ End point for the logged in user to get their details, change their details, or password.
  """
  if request.method == 'GET':
    data = current_user.data
    data['name'] = current_user.name
    return json.dumps(data)
  if request.method == 'POST':
    data = request.get_json()
    print data
    if data is None:
      return "No user data", 400
    if 'oldPassword' in data and 'newPassword' in data:
      try:
        set_password(current_user.name, data['oldPassword'], data['newPassword'])
      except IncorrectPasswordError:
        return "Bad password", 400
      del data['oldPassword'], data['newPassword']
    if 'oldPassword' in data or 'newPassword' in data:
      return "Bad password parameters", 400
    if 'user' in data:
      if 'role' in data['user']:
        del data['user']['role'] # a user cannot change their own role
      if not update_user(current_user.name, data['user']):
        return "Logged in user does not exist", 500
    return json.dumps({ 'status': 'OK' }), 200


@application.route('/login', methods=['GET', 'POST'])
def login():
  if request.method == 'POST':
    username = request.form['username']
    password = request.form['password']
    try:
      user = load_user(username, password)
      login_user(user)
      application.request_times[user.name] = time()
      application.logged_in_users.append(user.name)
    except IncorrectPasswordError:
      pass
  return redirect('/')

@application.route('/logout')
@role_required(['admin', 'freq', 'data'])
def logout():
  name = getattr(current_user, 'name', None)
  if name is not None and name in application.logged_in_users:
    application.logged_in_users.remove(name)
  logout_user()
  return redirect('/')


def _iter_export(config, hits):
  yield '#TimeDate,'
  if 'freqs' in config['freqs']:
    yield ','.join(freq['f'] * 10 ** int(freq['exp']) for freq in config['freqs']['freqs'])
  else:
    e = 10 ** int(config['freqs']['exp'])
    yield ','.join(str(f) for f in xrange(*[int(x * e) for x in config['freqs']['range']]))
  yield '\n'
  for hit in hits:
    dt = datetime.fromtimestamp(hit['fields']['timestamp'][0] / 1000.0)
    yield str(dt)
    yield ','
    yield ','.join([str(v) if v > -128 else '' for v in hit['fields']['level']])
    yield '\n'

# writes file locally (POST) or stream the output (GET)
@application.route('/export/<config_id>', methods=['GET', 'POST'])
@role_required(['admin', 'freq', 'data'])
def export(config_id):
  config = data_store.Config(config_id).read()
  try:
    export = _iter_export(config.values, list(config.iter_spectrum()))
  except StoreError as e:
    return e.message, 500
  if request.method == 'GET':
    return Response(export, mimetype='text/csv')
  else:
    path = os.path.join(EXPORT_DIRECTORY, config_id + '.csv')
    with open(path, 'w') as f:
      for x in export:
        f.write(x)
    return json.dumps({ 'path': path })


@application.route('/stats')
@role_required(['admin'])
def get_stats():
  return json.dumps(data_store.stats())


if __name__ == "__main__":
  import sys

  if 'debug' in sys.argv:
    application.debug = True
  application.run(host='0.0.0.0', port=8080)
