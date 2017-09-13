""" Package entry points to run processes and complete set-up.
"""
import time
import sys

try: # ordinary PSM
    import Hamlib
    from spectrum.worker import Worker
except ImportError: # SDR-Play version of PSM might have no Hamlib
    Hamlib = None

from spectrum.sdr_worker import SdrWorker
from spectrum.ams_worker import AmsWorker
from spectrum.power import power_on, power_off
from spectrum.monkey import Monkey
from spectrum.wav2mp3 import walk_convert
from spectrum.process import NoClient
from spectrum.fs_datastore import FsDataStore
from spectrum.config import DATA_PATH, WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS, MONKEY_RUN_PATH, \
                            MONKEY_POLL, CONVERT_PERIOD, USERS_FILE, ROUNDS, SSMTP_CONF, \
                            DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS, \
                            DEFAULT_SCAN_SETTINGS, VERSION_FILE, USER_TIMEOUT_SECS, PICO_PATH, \
                            EXPORT_DIRECTORY, LOG_PATH, PI_CONTROL_PATH, WORKER_CONFIG_FILE, \
                            MONKEY_CONFIG_FILE, EVENT_PATH, EVENT_POLL_SECS, EVENT_OVERSEER_URL, \
                            EVENT_OVERSEER_KEY
from spectrum.audio import AudioServer
from spectrum.users import Users
from spectrum.queue import Queue
from spectrum.event import EventManager, EventClient
from spectrum.common import log, psm_name


def init_application():
    """ Initiliase the web application object imported from spectrum.server.
    """
    from spectrum.server import application
    data_store = FsDataStore(DATA_PATH)
    if Worker is not None:
        worker_client = Worker(data_store, WORKER_RUN_PATH, WORKER_CONFIG_FILE, RADIO_ON_SLEEP_SECS).client()
    elif SdrWorker is not None:
        worker_client = SdrWorker(data_store, WORKER_RUN_PATH, WORKER_CONFIG_FILE).client()
    else:
        worker_client = AmsWorker(data_store, WORKER_RUN_PATH, WORKER_CONFIG_FILE).client()
    m_args = (data_store, MONKEY_RUN_PATH, MONKEY_CONFIG_FILE, MONKEY_POLL)
    monkey_client = Monkey(*m_args).client() if Monkey is not None else NoClient()
    event_client = EventClient(Queue(EVENT_PATH))
    application.initialise(data_store, Users(USERS_FILE, ROUNDS), worker_client, monkey_client,
                           DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS,
                           DEFAULT_SCAN_SETTINGS, LOG_PATH, VERSION_FILE, USER_TIMEOUT_SECS,
                           EXPORT_DIRECTORY, PI_CONTROL_PATH, PICO_PATH, event_client)
    return application


def server():
    """ Run the Flask web server.
    """
    application = init_application()
    application.debug = True
    application.run('0.0.0.0', port=8080)


def audio():
    """ Run the audio server (publishes left/right channels to a ZMQ socket).
    """
    with AudioServer() as server:
        server.run()


def worker():
    """ Run the Hamlib worker process, for collecting spectrum data.
    """
    if Hamlib is None:
        print "Hamlib is not installed - can not run Worker"
        sys.exit(1)
    w_args = (FsDataStore(DATA_PATH), WORKER_RUN_PATH, WORKER_CONFIG_FILE, RADIO_ON_SLEEP_SECS)
    worker_process = Worker(*w_args)
    worker_process.init()
    with open(log.path, 'a') as f:
        Hamlib.rig_set_debug_file(f)
        Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
        worker_process.start()

def sdr_worker():
    """ Run the SDR Play worker process, for collecting spectrum data.
    """
    worker_process = SdrWorker(FsDataStore(DATA_PATH), WORKER_RUN_PATH, WORKER_CONFIG_FILE)
    worker_process.init()
    worker_process.start()

def ams_worker():
    """ Run the AMS sensor worker process, for collecting spectrum data.
    """
    worker_process = AmsWorker(FsDataStore(DATA_PATH), WORKER_RUN_PATH, WORKER_CONFIG_FILE)
    worker_process.init()
    worker_process.start()

def monkey():
    """ Run the monkey process, for collecting RDS data.
    """
    if Hamlib is None:
        print "Hamlib is not installed - can not run Monkey"
        sys.exit(1)
    m_args = (FsDataStore(DATA_PATH), MONKEY_RUN_PATH, MONKEY_CONFIG_FILE, MONKEY_POLL)
    monkey_process = Monkey(*m_args)
    monkey_process.init()
    monkey_process.start()


def wav2mp3():
    """ Run the wav to mp3 conversion process.
    """
    if Hamlib is None:
        print "Hamlib, and therefore avconv, is not installed - can not convert"
        sys.exit(1)
    fsds = FsDataStore(DATA_PATH)
    while True:
        walk_convert(fsds.samples_path)
        log.debug("Sleeping for %ds", CONVERT_PERIOD)
        time.sleep(CONVERT_PERIOD)


def users():
    """ Create an admin user based on command line arguments.
    """
    if len(sys.argv) != 3:
        print "Usage: {0} <username> <password>".format(sys.argv[0])
        sys.exit(1)

    user_manager = Users(USERS_FILE, ROUNDS)
    user_manager.create_user(sys.argv[1], sys.argv[2], {'role': 'admin'})
    print "User {0} created".format(sys.argv[1])


def power():
    """ Power on or off the radio.
    """
    if Hamlib is None:
        print "Hamlib is not installed - can not power on/off"
        sys.exit(1)
    if len(sys.argv) != 2 or sys.argv[1] not in ('on', 'off'):
        print "Usage: {0} [on|off]".format(sys.argv[0])
        sys.exit(1)

    if sys.argv[1] == 'on':
        power_on()

    if sys.argv[1] == 'off':
        power_off()


def email():
    """ Set the email password.
    """
    if len(sys.argv) != 2:
        print "Usage: {0} <email password>".format(sys.argv[0])
        sys.exit(1)

    with open(SSMTP_CONF) as f:
        if 'AuthPass=' in f.read():
            print "Password already set"
            sys.exit(1)

    with open(SSMTP_CONF, 'a') as f:
        f.write("AuthPass={0}\n".format(sys.argv[1]))


def event():
    """ Run the PSM Event Manager.
    """
    if EVENT_OVERSEER_URL.strip() == '':
        print "Not running: overseer URL missing"
        return
    if EVENT_OVERSEER_KEY.strip() == '':
        print "Not running: overseer key missing"
        return
    args = (Queue(EVENT_PATH), EVENT_POLL_SECS, EVENT_OVERSEER_URL, EVENT_OVERSEER_KEY)
    manager = EventManager(psm_name(), *args)
    manager.run()
