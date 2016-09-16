# configuration settings used by worker.py and server.py
#FIXME use yaml

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

# audio samples directory, and how often (in s) the wav2mp3 converter should run
SAMPLES_DIRECTORY = 'samples'
CONVERT_PERIOD = 300

DATA_DIR = 'data'
SETTINGS_DIR = 'settings'