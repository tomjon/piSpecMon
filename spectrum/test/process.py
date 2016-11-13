""" Unit tests for the process module.
"""
import multiprocessing
import time
from spectrum.process import Process
from spectrum.datastore import ConfigBase
from spectrum.common import log


class MockConfig(ConfigBase):
    def read(self):
        return self

class MockDataStore(object):
    def __init__(self, counter, config_id):
        self.counter = counter
        self.config_id = config_id

    def config(self, config_id):
        return MockConfig(self, config_id=config_id)

class MockProcess(Process):
    def __init__(self, data_store, run_dir):
        super(MockProcess, self).__init__(data_store, run_dir)

    def iterator(self, config):
        config._data_store.config_id.value = config.id
        while True:
            config._data_store.counter.value += 1
            time.sleep(0.1)
            yield

def process_fn(tmpdir, counter, config_id):
    data_store = MockDataStore(counter, config_id)
    process = MockProcess(data_store, str(tmpdir))
    process.init()
    process.start()


def test(tmpdir):
    counter = multiprocessing.Value('i', 0)
    config_id = multiprocessing.Array('c', 'some random value')
    multiprocessing.Process(target=process_fn, args=(tmpdir, counter, config_id)).start()
    time.sleep(1)

    CONFIG_ID = 'my id'
    client = MockProcess(None, str(tmpdir)).client()
    client.start(CONFIG_ID)

    with open(client.process.config_file) as f:
        assert f.read().strip() == CONFIG_ID

    time.sleep(1)

    with open(client.process.config_file) as f:
        assert f.read().strip() == CONFIG_ID

    client.stop()
    client.exit()

    assert counter.value == 10
    assert config_id.value == CONFIG_ID
