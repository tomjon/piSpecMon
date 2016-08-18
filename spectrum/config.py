# configuration settings used by worker.py and server.py
#FIXME use yaml

# path where Flask's secret key is stored
SECRET_KEY = 'secret.key'

# path to the file worker.py writes its PID to
PID_FILE = ".pid"

ELASTICSEARCH = 'http://localhost:9200/'
EXPORT_DIRECTORY = '/tmp'

USERS_FILE = 'users.passwords'
ROUNDS = 10 ** 5

WORKER_CONFIG = '.config'
WORKER_MONITOR = '.monitor'

# GPIO radio 'on' script settings
RADIO_ON_SWITCH = 21 # BCM numbering
RADIO_ON_SLEEP_SECS = 1.0

# user session inactivity timeout
USER_TIMEOUT_SECS = 60

# audio samples directory, and how often (in s) the wav2mp3 converter should run
SAMPLES_DIRECTORY = 'samples'
CONVERT_PERIOD = 300
