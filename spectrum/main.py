""" Package entry points to run processes and complete set-up.
"""
import time
import sys
import Hamlib
from spectrum.fs_datastore import FsDataStore
from spectrum.config import DATA_PATH, WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS, MONKEY_RUN_PATH, \
                            MONKEY_POLL, CONVERT_PERIOD, USERS_FILE, ROUNDS, SSMTP_CONF, \
                            DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS, \
                            DEFAULT_SCAN_SETTINGS, VERSION_FILE, USER_TIMEOUT_SECS, \
                            EXPORT_DIRECTORY, LOG_PATH, PI_CONTROL_PATH
from spectrum.worker import Worker
from spectrum.monkey import Monkey
from spectrum.wav2mp3 import walk_convert
from spectrum.users import Users
from spectrum.power import power_on, power_off
from spectrum.server import application
from spectrum.common import log


def init_application():
    """ Initiliase the web application object imported from spectrum.server.
    """
    data_store = FsDataStore(DATA_PATH)
    worker_client = Worker(data_store, WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS).client()
    monkey_client = Monkey(data_store, MONKEY_RUN_PATH, MONKEY_POLL).client()
    application.initialise(data_store, Users(USERS_FILE, ROUNDS), worker_client, monkey_client,
                           DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS,
                           DEFAULT_SCAN_SETTINGS, LOG_PATH, VERSION_FILE, USER_TIMEOUT_SECS,
                           EXPORT_DIRECTORY, PI_CONTROL_PATH)
    return application


def server():
    """ Run the Flask web server.
    """
    init_application()
    application.debug = True
    application.run(host='0.0.0.0', port=8080)


def worker():
    """ Run the worker process, for collecting spectrum data.
    """
    worker_process = Worker(FsDataStore(DATA_PATH), WORKER_RUN_PATH, RADIO_ON_SLEEP_SECS)
    worker_process.init()
    with open(log.path, 'a') as f:
        Hamlib.rig_set_debug_file(f)
        Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
        worker_process.start()


def monkey():
    """ Run the monkey process, for collecting RDS data.
    """
    monkey_process = Monkey(FsDataStore(DATA_PATH), MONKEY_RUN_PATH, MONKEY_POLL)
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
