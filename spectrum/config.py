""" Configuration constants.
"""
import Hamlib

#FIXME use yaml
LOG_SIZE = 1024 * 1024

VERSION_FILE = '/version'

# path where Flask's secret key is stored
SECRET_KEY = 'secret.key'

# worker configuration
WORKER_PID = '.worker_pid'
WORKER_CONFIG = '.worker_config'
WORKER_STATUS = '.worker_status'

ELASTICSEARCH = 'http://localhost:9200/'
EXPORT_DIRECTORY = '/tmp'

USERS_FILE = 'users.passwords'
ROUNDS = 10 ** 5

# Monkey config (RDS decoder)
MONKEY_PID = '.monkey_pid'
MONKEY_CONFIG = '.monkey_config'
MONKEY_STATUS = '.monkey_status'
MONKEY_POLL = 1.0

# GPIO radio 'on' script settings
RADIO_ON_SWITCH = 21 # BCM numbering
RADIO_ON_SLEEP_SECS = 1.0

# user session inactivity timeout
USER_TIMEOUT_SECS = 60

# data directories
DATA_PATH = 'data'
SAMPLES_PATH = 'samples'
SETTINGS_PATH = 'settings'

# how often (in s) the wav2mp3 converter should run
CONVERT_PERIOD = 300

# default settings
try:
    DEFAULT_RIG_SETTINGS = {'model': Hamlib.RIG_MODEL_PSMTEST}
except AttributeError:
    DEFAULT_RIG_SETTINGS = {
        'model': Hamlib.RIG_MODEL_AR8200, 'pathname': '/foo', 'data_bits': 8,
        'rate': 9600, 'stop_bits': 1, 'parity': 2, 'attenuation': False,
        'radio_on': 2, 'set_check': 2, 'retries': 2, 'interval': 1000, 'write_delay': 50
    }
DEFAULT_AUDIO_SETTINGS = {
    'path': '/dev/dsp1', 'rate': 44100, 'period': 600, 'duration': 10, 'threshold': -20
}
DEFAULT_RDS_SETTINGS = {
    'device': '/dev/ttyACM0', 'strength_threshold': 40, 'strength_timeout': 20, 'rds_timeout': 300
}
DEFAULT_SCAN_SETTINGS = {
    'freqs': {'range': [87.5, 108.0, 0.1], 'exp': 6, 'freqs': [{'f': '', 'exp': 6}]},
    'monitor': {'radio_on': 1}, 'scan': {'mode': 64, 'rds': True, 'audio': False}
}
