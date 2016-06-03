# configuration settings used by worker.py and server.py
#FIXME use yaml

# path to the file worker.py writes its PID to
PID_FILE = ".pid"

ELASTICSEARCH = 'http://localhost:9200/'
EXPORT_DIRECTORY = '/tmp'
USERS_FILE = 'users.passwords'

WORKER_CONFIG = '.config'
WORKER_MONITOR = '.monitor'
