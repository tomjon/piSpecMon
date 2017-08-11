""" Package entry points to run processes and complete set-up.
"""
import time
import sys
import Hamlib
from ses_common.config import DATA_PATH, WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS, MONKEY_RUN_PATH, \
                              MONKEY_POLL, CONVERT_PERIOD, USERS_FILE, ROUNDS, SSMTP_CONF, \
                              DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS, \
                              DEFAULT_SCAN_SETTINGS, VERSION_FILE, USER_TIMEOUT_SECS, PICO_PATH, \
                              EXPORT_DIRECTORY, LOG_PATH, PI_CONTROL_PATH, WORKER_CONFIG_FILE, \
                              MONKEY_CONFIG_FILE, EVENT_PATH
from spectrum.fs_datastore import FsDataStore
from spectrum.worker import Worker
from spectrum.monkey import Monkey
from spectrum.wav2mp3 import walk_convert
from spectrum.users import Users
from spectrum.power import power_on, power_off
from spectrum.queue import Queue
from spectrum.event import EventManager, EventClient
from spectrum.common import log


def init_application():
    """ Initiliase the web application object imported from spectrum.server.
    """
    from spectrum.server import application
    data_store = FsDataStore(DATA_PATH)
    w_args = (data_store, WORKER_RUN_PATH, WORKER_CONFIG_FILE, RADIO_ON_SLEEP_SECS)
    worker_client = Worker(*w_args).client()
    m_args = (data_store, MONKEY_RUN_PATH, MONKEY_CONFIG_FILE, MONKEY_POLL)
    monkey_client = Monkey(*m_args).client()
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


def worker():
    """ Run the worker process, for collecting spectrum data.
    """
    w_args = (FsDataStore(DATA_PATH), WORKER_RUN_PATH, WORKER_CONFIG_FILE, RADIO_ON_SLEEP_SECS)
    worker_process = Worker(*w_args)
    worker_process.init()
    with open(log.path, 'a') as f:
        Hamlib.rig_set_debug_file(f)
        Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
        worker_process.start()


def monkey():
    """ Run the monkey process, for collecting RDS data.
    """
    m_args = (FsDataStore(DATA_PATH), MONKEY_RUN_PATH, MONKEY_CONFIG_FILE, MONKEY_POLL)
    monkey_process = Monkey(*m_args)
    monkey_process.init()
    monkey_process.start()


def wav2mp3():
    """ Run the wav to mp3 conversion process.
    """
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


def rdevice():
    """ Run the PSM Event Manager (RDevice implementation).
    """
    manager = EventManager(Queue(EVENT_PATH))
    manager.run()

