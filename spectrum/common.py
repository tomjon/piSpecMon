""" Common functions and logging setup.
"""
import logging
import logging.handlers
import sys
import os
import itertools
import time
from spectrum.config import LOG_PATH, LOG_SIZE


def get_logger():
    """ Get a logger based on the system path.
    """
    logger = logging.getLogger('werkzeug') # use this name so flask doesn't use its own logger
    logger.setLevel(logging.DEBUG)

    # create file handler which logs even debug messages (these end up in log file)
    logger.filename = '{0}.log'.format(os.path.basename(sys.argv[0]).replace('.py', ''))
    logger.path = os.path.join(LOG_PATH, logger.filename)
    rf_handler = logging.handlers.RotatingFileHandler(logger.path, maxBytes=LOG_SIZE, backupCount=0)
    rf_handler.setLevel(logging.INFO)

    # create console handler with a higher log level (these end up in system journal)
    c_handler = logging.StreamHandler()
    c_handler.setLevel(logging.DEBUG if 'debug' in sys.argv else logging.ERROR)

    # create formatter and add it to the handlers
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    rf_handler.setFormatter(formatter)
    c_handler.setFormatter(formatter)

    # add the handlers to the logger
    logger.addHandler(rf_handler)
    logger.addHandler(c_handler)

    return logger

#FIXME replace with per-process invocation?
log = get_logger() # pylint: disable=invalid-name


class FakeLogger(object):
    """ Fake logger that does nothing.
    """
    def error(self, *_): # pylint: disable=missing-docstring
        pass

    def warn(self, *_): # pylint: disable=missing-docstring
        pass

    def info(self, *_): # pylint: disable=missing-docstring
        pass

    def debug(self, *_): # pylint: disable=missing-docstring
        pass


def now():
    """ Return time in milliseconds since the epoch.
    """
    return int(time.time() * 1000)


def scan(freqs=None, range=None, **_): # pylint: disable=redefined-builtin
    """ Iterate frequency indices and frequency values in the specified list and range.
    """
    idx = 0
    for freq in itertools.chain(freqs or [], xrange(*range) if range is not None else []):
        yield idx, freq
        idx += 1


def _convert(dic):
    """ Auto-convert empty strings into None, number strings into numbers, and boolean
        strings into booleans. Recurse into dictionaries.
    """
    for k, v in dic.iteritems():
        if isinstance(v, dict):
            _convert(v)
        if not isinstance(v, basestring):
            continue
        v = v.strip()
        if v == '':
            dic[k] = None
            continue
        if v.lower() == 'true':
            dic[k] = True
            continue
        if v.lower() == 'false':
            dic[k] = False
            continue
        try:
            dic[k] = int(v)
            continue
        except (ValueError, TypeError):
            pass
        try:
            dic[k] = float(v)
            continue
        except (ValueError, TypeError):
            pass


def parse_config(config):
    """ Convert the given config using _convert, and return parsed scan settings.
    """
    _convert(config)
    scan_cfg = {}
    if 'freqs' in config:
        for x in config['freqs']:
            # x is either 'range' or 'freqs'
            if x == 'range':
                exp = int(config['freqs']['exp'])
                scan_cfg[x] = [int(10 ** exp * float(f)) for f in config['freqs'][x]]
                scan_cfg[x][1] += scan_cfg[x][2] / 2 # ensure to include the end of the range
            elif x == 'freqs':
                scan_cfg[x] = [int(10 ** int(f['exp']) * float(f['f'])) for f in config['freqs'][x]]
            else:
                raise ValueError("Bad key in config.freqs")
            break
        else:
            raise ValueError("No frequencies in config.freqs")
    return scan_cfg


def fs_size(path):
    """ Return file system usage at the given path.
    """
    result = os.popen('du -sk {0}'.format(path)).read()
    try:
        return int(result.split('\t')[0]) * 1024
    except ValueError:
        return 0

def fs_free(path):
    """ Return file system space free for the volume containing the given path.
    """
    result = os.popen('df -k {0}'.format(path)).read()
    try:
        return int(result.split('\n')[1].split()[3]) * 1024
    except ValueError:
        return 0
