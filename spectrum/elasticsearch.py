from config import *
from common import *
from time import sleep
import requests


def wait_for_elasticsearch():
    """ Wait for Elasticsearch to be up and running during module import.
    """
    while True:
        try:
            r = requests.get('%s/_cluster/health' % ELASTICSEARCH)
            if r.status_code != 200:
                log.warn("Elasticsearch status %s" % r.status_code)
            else:
                status = r.json()['status']
                if status != 'red':
                    log.info("Elasticsearch up and running ({0})".format(status))
                    return
                log.warn("Elasticsearch cluster health status: %s" % status)
        except requests.exceptions.ConnectionError:
            log.warn("No elasticsearch... waiting")
        sleep(2)


def create_index():
    """ Create index (harmless if it already exists).
    """
    wait_for_elasticsearch()
    with open(local_path('create.json')) as f:
        r = requests.put('{0}spectrum'.format(ELASTICSEARCH), data=f.read())
        log.debug("Code {0} creating index".format(r.status_code))
    wait_for_elasticsearch()


def read_config(config_id):
    r = requests.get('%s/spectrum/config/_search?fields=*&q=_id:%s' % (ELASTICSEARCH, config_id))
    if r.status_code != 200:
        raise StoreError("Could not get from Elasticsearch ({0})".format(r.status_code))
    hits = r.json()['hits']['hits']
    return json.loads(hits[0]['fields']['json'][0]) if len(hits) > 0 else None


def write_rds_name(config_id, freq_n, name):
    data = { 'config_id': config_id, 'idx': freq_n, 'timestamp': now(), 'name': name }
    r = requests.post(ELASTICSEARCH + '/spectrum/name/', params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 201:
        raise StoreError("Could not post to Elasticsearch ({0})".format(r.status_code))


def write_rds_text(config_id, freq_n, text):
    data = { 'config_id': config_id, 'idx': freq_n, 'timestamp': now(), 'text': text }
    r = requests.post(ELASTICSEARCH + '/spectrum/text/', params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 201:
        raise StoreError("Could not post to Elasticsearch ({0})".format(r.status_code))


def set_settings(id, value):
    #FIXME please standardize on now() here (ie ms since epoch)
    data = { 'timestamp': int(time()), 'json': json.dumps(value) }
    r = requests.put(ELASTICSEARCH + 'spectrum/settings/' + id, params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 200 and r.status_code != 201:
        raise StoreError("Can not set settings: %s (%d)" % (id, r.status_code))
    return value


def get_settings(id, new={}):
    """ Get the settings by id from Elasticsearch.  If not present, create new with the given value, and return it.
    """
    params = { 'fields': 'json' }
    r = requests.get(ELASTICSEARCH + 'spectrum/settings/' + id, params=params)
    log.debug("get_settings status code {0}: {1}".format(r.status_code, r.json()))
    if r.status_code == 404:
        log.info("Initialising settings: {0}".format(id))
        set_settings(id, new)
        return new
    elif r.status_code != 200:
        raise StoreError("Can not get settings: %s (%d)" % (id, r.status_code))
    fields = r.json()['fields']
    return json.loads(fields['json'][0])


def write_config(config):
    """ Post config to data store.
    """
    data = { 'timestamp': now(), 'json': json.dumps(config) }
    r = requests.post(ELASTICSEARCH + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 201:
        raise StoreError("Can not post config: %s (%d)" % (id, r.status_code))
    return r.json()['_id']


def read_configs():
    r = requests.get(ELASTICSEARCH + 'spectrum/config/_search', params='size=10000&fields=json,timestamp&sort=timestamp')
    if r.status_code != 200:
        raise StoreError("Elasticsearch error finding config sets: %s (%d)" % r.status_code)
    hits = r.json()['hits']['hits'] if 'hits' in r.json()['hits'] else [ ]
    return [{ 'id': hit['_id'], 'config': json.loads(hit['fields']['json'][0]), 'timestamp': int(hit['fields']['timestamp'][0]) } for hit in hits]


def read_config(config_id):
    r = requests.get(ELASTICSEARCH + 'spectrum/config/' + config_id, params='fields=timestamp,json')
    if r.status_code != 200:
        raise StoreError("Elasticsearch error finding config set: {0}".format(r.status_code))
    fields = r.json()['fields']
    return { 'config': json.loads(fields['json'][0]), 'timestamp': int(fields['timestamp'][0]) }


def delete_config(config_id):
    """ Delete config and all associated data.
    """
    # delete anything referring to this config_id
    r = requests.delete(ELASTICSEARCH + 'spectrum/_query', params='refresh=true&q=config_id:' + config_id)
    if r.status_code != 200:
        raise StoreError("Elasticsearch error deleting spectrum and RDS data: {0}".format(r.status_code))
    # delete config itself
    r = requests.delete(ELASTICSEARCH + 'spectrum/config/' + config_id, params='refresh=true')
    if r.status_code != 200:
        raise StoreError("Elasticsearch error deleting config set: {0}".format(r.status_code))


def sweep_info(config_id):
    r = requests.get(ELASTICSEARCH + 'spectrum/sweep/_search', params='size=1&q=config_id:' + config_id + '&fields=timestamp&sort=timestamp:desc')
    if r.status_code != 200:
        raise StoreError("Elasticsearch error getting range: {0}".format(r.status_code))
    ret = { 'count': r.json()['hits']['total'] }
    if ret['count'] > 0:
        ret['range'] = int(r.json()['hits']['hits'][0]['fields']['timestamp'][0])
    return ret


def write_data(config_id, timestamp, strengths):
    sweep = { 'config_id': config_id, 'timestamp': timestamp, 'level': strengths }
    r = requests.post(ELASTICSEARCH + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=json.dumps(sweep))
    if r.status_code != 201:
        log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
        return


def _range_search(config_id, start, end):
    q = 'config_id:' + config_id
    if start is not None and end is not None:
        q += '+AND+timestamp:[' + start + '+TO+' + end + ']'
    return 'size=10000&q=' + q + '&fields=config_id,timestamp,level,idx,name,text,freq_n,sweep_n&sort=timestamp'


def read_data(config_id, start=None, end=None):
    r = requests.get(ELASTICSEARCH + 'spectrum/sweep/_search', params=_range_search(config_id, start, end))
    if r.status_code != 200:
        raise StoreError("Elasticsearch error getting spectrum data: {0}".format(r.status_code))
    return r.json()['hits']['hits']


def read_audio(config_id, start=None, end=None):
    r = requests.get(ELASTICSEARCH + 'spectrum/audio/_search', params=_range_search(config_id, start, end))
    if r.status_code != 200:
        raise StoreError("Elasticsearch error getting audio data: {0}".format(r.status_code))
    return r.json()['hits']['hits']


def read_rds_names(config_id, start=None, end=None):
    r = requests.get(ELASTICSEARCH + 'spectrum/name/_search', params=_range_search(config_id, start, end))
    if r.status_code != 200:
        raise StoreError("Elasticsearch error getting RDS name data: {0}".format(r.status_code))
    return r.json()['hits']['hits']


def read_rds_text(config_id, start=None, end=None):
    r = requests.get(ELASTICSEARCH + 'spectrum/text/_search', params=_range_search(config_id, start, end))
    if r.status_code != 200:
        raise StoreError("Elasticsearch error getting RDS text data: {0}".format(r.status_code))
    return r.json()['hits']['hits']


def stats():
    r = requests.get(ELASTICSEARCH + 'spectrum/_stats/docs,store')
    if r.status_code != 200:
        raise StoreError("Elasticsearch error getting stats: {0}".format(r.status_code))
    stats = r.json()['indices']['spectrum']['primaries']
    return { 'doc_count': stats['docs']['count'], 'size_in_bytes': stats['store']['size_in_bytes'] }


def write_error(config_id, e):
    data = { 'timestamp': now(), 'config_id': config_id, 'json': json.dumps(str(e)) }
    requests.post(ELASTICSEARCH + 'spectrum/error/', params={ 'refresh': 'true' }, data=json.dumps(data))


def write_audio(config_id, t0, sweep_n, idx):
    data = { 'config_id': config_id, 'timestamp': t0, 'sweep_n': sweep_n, 'freq_n': idx }
    r = requests.post(ELASTICSEARCH + '/spectrum/audio/', params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 201:
        log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
        return


# initialise by creating the index and waiting for it to be ready
create_index()
