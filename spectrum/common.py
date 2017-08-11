""" Common functions and logging setup.
"""
import sys
import os
import itertools
import time
from ses_common.config import LOG_PATH, LOG_SIZE, LOG_LEVEL


log = get_logger(name='werkzeug', dir_path=LOG_PATH, size=LOG_SIZE, level=LOG_LEVEL) # pylint: disable=invalid-name


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


def freq(freq_n, **args): # pylint: disable=redefined-builtin
    """ Return the frequency for the given freq_n.  Use of this is fairly inefficient
        because the whole range of frequencies is generated each time.
    """
    return next(itertools.islice(scan(**args), freq_n, None))[1]


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
