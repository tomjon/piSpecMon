# configuration settings used by worker.py and server.py
#FIXME use yaml

# path to the file worker.py writes its PID to
PID_FILE = ".pid"

ELASTICSEARCH = 'http://localhost:9200/'
EXPORT_DIRECTORY = '/tmp'
USERS_FILE = 'users.passwords'

WORKER_CONFIG = '.config'
WORKER_MONITOR = '.monitor'

# GPIO radio 'on' script settings
RADIO_ON_SWITCH = 21 # BCM numbering
RADIO_ON_SLEEP_SECS = 1.0
