""" Unit tests for the server module.
"""
import multiprocessing
import time
import httplib
import json
import os
import pytest
from spectrum.process import Process
from spectrum.datastore import ConfigBase, SettingsBase
from spectrum.common import log
from spectrum.users import IncorrectPasswordError, InvalidUsername
import spectrum.server as server

LOGIN = {'username': 'bilbo', 'password': 'baggins'}
USER_DATA = {'role': 'data'}
DESCRIPTION = 'description message'
USER_TIMEOUT_SECS = 2
PI_CONTROL_PATH = ''
TEST_VERSION = 'v1.test'

class MockConfig(ConfigBase):
    """ Minimal mock Config implementation.
    """
    def read(self):
        """ Do nothing.
        """
        return self

class MockSettings(SettingsBase):
    """ Mock Settings implementation.
    """
    def read(self, defaults=None):
        """ Only sets values if id is 'description', otherwises uses defaults.
        """
        if self.id == 'description':
            self.values = DESCRIPTION
        else:
            self.values = defaults
        return self

class MockDataStore(object):
    """ Mock data store implementation, that only knows how to return (mock) Config
        and Settings.
    """
    def __init__(self):
        pass

    def config(self, config_id):
        """ Return a MockConfig with the given id.
        """
        return MockConfig(self, config_id=config_id)

    def settings(self, settings_id):
        """ Return a MockSettings with the given id.
        """
        return MockSettings(self, settings_id=settings_id)

class MockUsers(object):
    """ Mock Users implementation that only knows one user.
    """
    def check_user(self, username, password):
        """ Only knows about the LOGIN user and returns USER_DATA.
        """
        if username == LOGIN['username']:
            if password == LOGIN['password']:
                return USER_DATA
            raise IncorrectPasswordError()
        raise InvalidUsername()

    def get_user(self, username):
        """ Only knows about the LOGIN user and returns USER_DATA.
        """
        return USER_DATA if username == LOGIN['username'] else None

class MockWorkerClient(object):
    """ Minimal mock WorkerClient.
    """
    pass

class MockMonkeyClient(object):
    """ Minimal mock MonkeyClient.
    """
    pass

@pytest.fixture()
def api(tmpdir):
    """ Pytest fixture returning a configured test web API.
    """
    log_path = os.path.join(str(tmpdir), 'logs')
    os.makedirs(log_path)

    version_file = os.path.join(str(tmpdir), 'version')
    with open(version_file, 'w') as f:
        f.write(TEST_VERSION)

    export_directory = os.path.join(str(tmpdir), 'export')
    os.makedirs(export_directory)

    server.application.initialise(MockDataStore(), MockUsers(), MockWorkerClient(),
                                  MockMonkeyClient(), {}, {}, {}, {}, log_path,
                                  version_file, USER_TIMEOUT_SECS,
                                  export_directory, PI_CONTROL_PATH)
    return server.application.test_client()


def test_favicon(api):
    """ Test favicon endpoint.
    """
    # can get a favicon even when not logged in
    rv = api.get('/favicon.ico')
    assert rv.status_code == httplib.OK
    assert rv.headers['Content-Type'].startswith('image/')

def test_login(api):
    """ Test login, ident and user endpoints.
    """
    # root URL should redirect to /login.html
    rv = api.get('/', follow_redirects=True)
    assert 'enter your' in rv.data

    # we aren't logged in, so should be unauthorized for, say, /ident
    rv = api.get('/ident')
    assert rv.status_code == httplib.UNAUTHORIZED

    # log in, which should redirect to /index.html
    rv = api.post('/login', data=LOGIN, follow_redirects=True)
    assert rv.status_code == httplib.OK
    assert '<title>' in rv.data

    # now the root URL should redirect to /index.html
    rv = api.get('/', follow_redirects=True)
    assert '<title>' in rv.data

    # check my user details
    rv = api.get('/user')
    assert rv.status_code == httplib.OK
    user = json.loads(rv.data)
    assert user['name'] == 'bilbo'
    assert user['role'] == 'data'

    # now try /ident again
    rv = api.get('/ident')
    assert rv.status_code == httplib.OK
    ident = json.loads(rv.data)
    assert ident['version'] == TEST_VERSION
    assert ident['description'] == DESCRIPTION

    # let my login lapse, then log back in
    time.sleep(USER_TIMEOUT_SECS + 1)
    rv = api.get('/ident')
    assert rv.status_code == httplib.UNAUTHORIZED
    rv = api.post('/login', data=LOGIN, follow_redirects=True)
    assert rv.status_code == httplib.OK
    assert '<title>' in rv.data
