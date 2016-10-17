""" Data store implementation powered by Elasticsearch.
"""

import time
import json
import requests
from config import ELASTICSEARCH, SAMPLES_PATH
from common import log, local_path, fs_size, fs_free
from datastore import ConfigBase, SettingsBase, StoreError

REFRESH = {'refresh': 'true'}


def _wait_for_elasticsearch():
    # wait for Elasticsearch to be up and running during module import
    while True:
        try:
            req = requests.get('%s/_cluster/health' % ELASTICSEARCH)
            if req.status_code != 200:
                log.warn("Elasticsearch status %s", req.status_code)
            else:
                status = req.json()['status']
                if status != 'red':
                    log.info("Elasticsearch up and running (%s)", status)
                    return
                log.warn("Elasticsearch cluster health status: %s", status)
        except requests.exceptions.ConnectionError:
            log.warn("No elasticsearch... waiting")
        time.sleep(2)


def _create_index():
    # create index (harmless if it already exists)
    _wait_for_elasticsearch()
    with open(local_path('create.json')) as f:
        req = requests.put('{0}spectrum'.format(ELASTICSEARCH), data=f.read())
        log.debug("Code %s creating index", req.status_code)
    _wait_for_elasticsearch()


def _url(path, *args):
    # form an Elasticsearch URL for the 'spectrum' index
    path = path.format(*args)
    return "{0}spectrum/{1}".format(ELASTICSEARCH, path)


class ElasticsearchError(StoreError):
    """ A specific StoreError for elasticsearch.
    """

    def __init__(self, req):
        text = "Elasticsearch error ({1}): {0}".format(req.url, req.status_code)
        super(ElasticsearchError, self).__init__(text)


class Config(ConfigBase):
    """ Config implementation for Elasticsearch.
    """

    @staticmethod
    def iter():
        """ Yield stored Config objects.
        """
        params = {'size': 10000, 'fields': 'json,timestamp', 'sort': 'timestamp'}
        req = requests.get(_url('config/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        if 'hits' in req.json()['hits']:
            for hit in req.json()['hits']['hits']:
                values = json.loads(hit['fields']['json'][0])
                timestamp = int(hit['fields']['timestamp'][0])
                config = Config(hit['_id'], values, timestamp)
                config._extra_info() # pylint: disable=protected-access
                yield config

    def read(self):
        """ Read config attributes from the data store.
        """
        params = {'fields': 'timestamp,json'}
        req = requests.get(_url('config/{0}', self.id), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        values = req.json()['fields']
        self.values = json.loads(values['json'][0])
        self.timestamp = int(values['timestamp'][0])
        self._extra_info()
        return self

    def write(self, timestamp=None, values=None):
        """ Write config attributes to the data store.
        """
        if values is not None:
            self.values = values
        if timestamp is not None:
            self.timestamp = timestamp
        data = {'timestamp': self.timestamp, 'json': json.dumps(self.values)}
        req = requests.post(_url('config/'), params=REFRESH, data=json.dumps(data))
        if req.status_code != 201:
            raise ElasticsearchError(req)
        self.id = req.json()['_id']
        return self

    def delete(self):
        """ Delete the config and all associated data from the data store.
        """
        # delete anything referring to this config_id
        params = {'q': 'config_id:{0}'.format(self.id)}
        params.update(REFRESH)
        req = requests.delete(_url('_query'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        # delete config itself
        req = requests.delete(ELASTICSEARCH + 'spectrum/config/' + self.id, params=REFRESH)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        # render config object useless (id no longer valid)
        self.id = None

    def _extra_info(self):
        # read count and latest timestamp from elasticsearch
        params = {
            'size': 1, 'q': 'config_id:{0}'.format(self.id),
            'fields': 'timestamp', 'sort': 'timestamp:desc'
        }
        req = requests.get(_url('sweep/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        self.count = req.json()['hits']['total']
        if self.count > 0:
            self.latest = int(req.json()['hits']['hits'][0]['fields']['timestamp'][0])
        else:
            self.first = None
            self.latest = None
            return
        # and repeat to get timestamp of first sweep
        params['sort'] = 'timestamp:asc'
        req = requests.get(_url('sweep/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        self.first = int(req.json()['hits']['hits'][0]['fields']['timestamp'][0])

    def _range_search(self, start, end):
        # formulate parameters for a range from start to end
        params = {
            'q': 'config_id:{0}'.format(self.id), 'size': 10000,
            'fields': 'config_id,timestamp,level,idx,name,text,freq_n,sweep_n',
            'sort': 'timestamp'
        }
        if start is not None and end is not None:
            params['q'] += ' AND timestamp:[{0} TO {1}]'.format(start, end)
        return params

    def iter_spectrum(self, start=None, end=None):
        """ Yield (timestamp, strengths) for each spectrum sweep in the range (or all).
        """
        params = self._range_search(start, end)
        req = requests.get(_url('sweep/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        for hit in req.json()['hits']['hits']:
            yield hit['fields']['timestamp'][0], hit['fields']['level']

    def write_spectrum(self, timestamp, strengths):
        """ Write spectrum strengths found at the given timestamp.
        """
        data = {'config_id': self.id, 'timestamp': timestamp, 'level': strengths}
        req = requests.post(_url('sweep/'), params=REFRESH, data=json.dumps(data))
        if req.status_code != 201:
            raise ElasticsearchError(req)

    def iter_audio(self, start=None, end=None):
        """ Yield (timestamp, freq_n, path) for stored audio samples in the range (or all).
        """
        params = self._range_search(start, end)
        req = requests.get(_url('audio/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        for hit in req.json()['hits']['hits']:
            yield hit['fields']['timestamp'][0], hit['fields']['freq_n'][0]

    def write_audio(self, timestamp, freq_n):
        """ Write freq_n and timestamp for an audio sample.
        """
        data = {'config_id': self.id, 'timestamp': timestamp, 'freq_n': freq_n}
        req = requests.post(_url('audio/'), params=REFRESH, data=json.dumps(data))
        if req.status_code != 201:
            raise ElasticsearchError(req)
        return self.audio_path(timestamp, freq_n)

    def iter_rds_name(self, start=None, end=None):
        """ Yield (timestamp, freq_n, name) for RDS names in the range (or all).
        """
        params = self._range_search(start, end)
        req = requests.get(_url('name/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        for hit in req.json()['hits']['hits']:
            yield hit['fields']['timestamp'][0], hit['fields']['idx'][0], hit['fields']['name'][0]

    def write_rds_name(self, timestamp, freq_n, name):
        """ Write freq_n and timestamp for an RDS name.
        """
        data = {
            'config_id': self.id, 'idx': freq_n,
            'timestamp': timestamp, 'name': name
        }
        req = requests.post(_url('name/'), params=REFRESH, data=json.dumps(data))
        if req.status_code != 201:
            raise ElasticsearchError(req)

    def iter_rds_text(self, start=None, end=None):
        """ Yield (timestamp, freq_n, text) for RDS text in the range (or all).
        """
        params = self._range_search(start, end)
        req = requests.get(_url('text/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        for hit in req.json()['hits']['hits']:
            yield hit['fields']['timestamp'][0], hit['fields']['idx'][0], hit['fields']['text'][0]

    def write_rds_text(self, timestamp, freq_n, text):
        """ Write freq_n, timestamp and text for RDS text in the range (or all).
        """
        data = {
            'config_id': self.id, 'idx': freq_n,
            'timestamp': timestamp, 'text': text
        }
        req = requests.post(_url('text/'), params=REFRESH, data=json.dumps(data))
        if req.status_code != 201:
            raise ElasticsearchError(req)

    def iter_error(self):
        """ Yield (timestamp, values) for all errors.
        """
        params = {'q': 'config_id:{0}'.format(self.id)}
        req = requests.get(_url('error/_search'), params=params)
        if req.status_code != 200:
            raise ElasticsearchError(req)
        for hit in req.json()['hits']['hits']:
            yield hit['fields']['timestamp'][0], json.loads(hit['fields']['json'][0])

    def write_error(self, timestamp, e):
        """ Write an error at the given timestamp.
        """
        data = {
            'timestamp': timestamp, 'config_id': self.id,
            'json': json.dumps(str(e))
        }
        req = requests.post(_url('error/'), params=REFRESH, data=json.dumps(data))
        if req.status_code != 201:
            raise ElasticsearchError(req)


class Settings(SettingsBase):
    """ Elasticsearch implementation of Settings.
    """

    def read(self, defaults=None):
        """ Read settings value, using the defaults given if it is not already set.
        """
        params = {'fields': 'json'}
        req = requests.get(_url('settings/{0}', self.id), params=params)
        log.debug("get_settings status code %s: %s", req.status_code, req.json())
        if req.status_code == 404:
            if defaults is None:
                raise StoreError("No defaults and no settings for {0}".format(self.id))
            log.info("Initialising settings: %s", self.id)
            self.values = defaults or {}
            self.write()
            return self
        elif req.status_code != 200:
            raise ElasticsearchError(req)
        fields = req.json()['fields']
        self.values = json.loads(fields['json'][0])
        return self

    def write(self, values=None):
        """ Write settings value.
        """
        if values is not None:
            self.values = values
        data = {'json': json.dumps(self.values)}
        req = requests.put(_url('settings/{0}', self.id), params=REFRESH, data=json.dumps(data))
        if req.status_code != 200 and req.status_code != 201:
            raise ElasticsearchError(req)
        return self


def stats():
    """ Return a dictionary of statistics name/values.
    """
    req = requests.get(_url('_stats/docs,store'))
    if req.status_code != 200:
        raise ElasticsearchError(req)
    values = req.json()['indices']['spectrum']['primaries']
    return {
        'audio': fs_size(SAMPLES_PATH),
        'size': values['store']['size_in_bytes'],
        'free': fs_free(SAMPLES_PATH)
    }


# initialise by creating the index and waiting for it to be ready
_create_index()
