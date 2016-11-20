""" Unit tests for the process module.
"""
import multiprocessing
import time
from spectrum.process import Process
from spectrum.datastore import ConfigBase


class MockConfig(ConfigBase):
    """ Minimal mock Config implementation.
    """
    def read(self):
        """ Does nothing.
        """
        return self

class MockDataStore(object):
    """ Mock data store implementation defining a counter used by TestProcess.
    """
    def __init__(self, counter, config_id):
        self.counter = counter
        self.config_id = config_id

    def config(self, config_id):
        """ Return a MockConfig with the given id.
        """
        return MockConfig(self, config_id=config_id)

class TestProcess(Process):
    """ Test process implementation that increments the data store's counter every so often.
    """
    def __init__(self, data_store, run_dir):
        super(TestProcess, self).__init__(data_store, run_dir)

    def iterator(self, config):
        config._data_store.config_id.value = config.id # pylint: disable=protected-access
        while True:
            config._data_store.counter.value += 1 # pylint: disable=protected-access
            time.sleep(0.1)
            yield

def process_fn(tmpdir, counter, config_id):
    """ We run this is a child process.
    """
    data_store = MockDataStore(counter, config_id)
    process = TestProcess(data_store, str(tmpdir))
    process.init()
    process.start()


def test(tmpdir):
    """ Test starting and stopping the TestProcess, and check the counter does what we expect.
    """
    counter = multiprocessing.Value('i', 0)
    config_id = multiprocessing.Array('c', 'some random value')
    multiprocessing.Process(target=process_fn, args=(tmpdir, counter, config_id)).start()
    time.sleep(1)

    CONFIG_ID = 'my id'
    client = TestProcess(None, str(tmpdir)).client()
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
