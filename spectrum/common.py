""" Common functions and logging setup.
"""
import sys
import os
import itertools
import time
from ses_common.logger import get_logger
from ses_common.config import LOG_PATH, LOG_SIZE, LOG_LEVEL


log = get_logger(name='werkzeug', dir_path=LOG_PATH, size=LOG_SIZE, level=LOG_LEVEL) # pylint: disable=invalid-name


def now():
    """ Return time in milliseconds since the epoch.
    """
    return int(time.time() * 1000)


def freq(freq_n, scan_config): # pylint: disable=redefined-builtin
    """ Return the frequency for the given freq_n.  Use of this is fairly inefficient
        because the whole range of frequencies is generated each time.
    """
    return next(itertools.islice(scan(scan_config), freq_n, None))[1]


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


#FIXME prefer to do the interpretation of freq specs, to produce a generator, in one step
def parse_config(config, worker):
    """ Convert the given config using _convert, and return parsed scan settings.
        The return value may be fed into scan().
    """
    _convert(config)
    scan_cfg = []
    if worker in config and 'freqs' in config[worker]:
        for x in config[worker]['freqs']:
            # x is either a range or a single frequency
            if 'range' in x and x.get('enabled', False):
                scan_cfg.append([int(10 ** x['exp'] * float(f)) for f in x['range']])
                scan_cfg[-1][1] += scan_cfg[-1][2] / 2 # ensure to include the end of the range
            elif 'freq' in x and x.get('enabled', False):
                scan_cfg.append(int(10 ** int(x['exp']) * float(x['freq'])))
    return scan_cfg

#FIXME prefer to do the interpretation of freq specs, to produce a generator, in one step
def scan(scan_config): # pylint: disable=redefined-builtin
    """ Iterate frequency indices and frequency values in the specified scan config.
    """
    idx = 0
    for freq in itertools.chain(*[xrange(*x) if isinstance(x, list) else [x] for x in scan_config]):
        yield idx, freq
        idx += 1


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

def check_device(value):
    """ Check that the input specifies a valid device path, and return that path.
    """
    if os.path.basename(value) != value:
        raise Exception("Bad device specifier: {0}".format(value))
    return '/dev/{0}'.format(value)

def psm_name():
    """ Return the box name.
    """
    return os.popen('uname -n').read().strip()

def mkdirs(file_path):
    """ Ensure parent directories for the given file path exist (creating them
        if not).
    """
    path = os.path.dirname(file_path)
    if not os.path.exists(path):
        os.makedirs(path)
