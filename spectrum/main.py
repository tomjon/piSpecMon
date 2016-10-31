import Hamlib
import time
import sys
from spectrum.fs_datastore import FsDataStore
from spectrum.config import DATA_PATH, WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS, \
                            MONKEY_RUN_PATH, MONKEY_POLL, CONVERT_PERIOD, \
                            USERS_FILE, ROUNDS
from spectrum.worker import Worker
from spectrum.monkey import Monkey
from spectrum.users import Users
from spectrum.power import power_on, power_off
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


def wav2mp3():
    fsds = FsDataStore(DATA_PATH)
    while True:
        walk_convert(fsds.samples_path)
        log.debug("Sleeping for %ds", CONVERT_PERIOD)
        time.sleep(CONVERT_PERIOD)


def users():
    if len(sys.argv) != 3:
        print "Usage: {0} <username> <password>".format(sys.argv[0])
        sys.exit(1)

    users = Users(USERS_FILE, ROUNDS)
    users.create_user(sys.argv[1], sys.argv[2], {'role': 'admin'})
    print "User {0} created".format(sys.argv[1])


def power():
    if len(sys.argv) != 2 or sys.argv[1] not in ('on', 'off'):
        print "Usage: {0} [on|off]".format(sys.argv[0])
        sys.exit(1)

    if sys.argv[1] == 'on':
        power_on()

    if sys.argv[1] == 'off':
        power_off()
