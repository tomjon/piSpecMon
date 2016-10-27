import Hamlib
from spectrum.fs_datastore import FsDataStore
from spectrum.config import DATA_PATH, WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS, \
                            MONKEY_RUN_PATH, MONKEY_POLL
from spectrum.worker import Worker
from spectrum.monkey import Monkey
from spectrum.common import log


def worker():
    worker = Worker(FsDataStore(DATA_PATH), WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS)
    worker.init()
    with open(log.path, 'a') as f:
        Hamlib.rig_set_debug_file(f)
        Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
        worker.start()


def monkey():
    monkey = Monkey(FsDataStore(DATA_PATH), MONKEY_RUN_PATH, MONKEY_POLL)
    monkey.init()
    monkey.start()
