import os
import struct

""" Python module for storing spectrum data in a binary format.

    For each id, maintains:
    
      * a format file
      * a config file
      * a timestamp file
      * a sweep data file
"""

DATA_DIR = 'data'

def _fread(f, format):
    n = struct.calcsize(format)
    s = f.read(n)
    if len(s) == 0:
        return None
    return struct.unpack(format, s)

def init(config_id, size):
    with open(os.path.join(DATA_DIR, config_id, 'format'), 'w') as f:
        f.write(struct.pack('I', size))

def write(config_id, timestamp, strengths):
    """ Write sweep data.
    
        config_id - configuration id (string)
        timestamp - milliseconds since the epoch at start of sweep (integer)
        strengths - array of strength values (signed byte -128 .. 127)
    """
    n = len(strengths)

    with open(os.path.join(DATA_DIR, config_id, 'format'), 'r') as f:
        _n = struct.unpack('I', f.read())[0]
        if _n != n:
            raise Exception("Bad number of strength readings: {0} should be {1}".format(n, _n))

    with open(os.path.join(DATA_DIR, config_id, 'timestamps'), 'a') as f:
        f.write(struct.pack('L', timestamp))

    with open(os.path.join(DATA_DIR, config_id, 'data'), 'a') as f:
        f.write(struct.pack('{0}b'.format(n), *strengths))

def read(config_id, timestamp_0, timestamp_1):
    """ Read (binary?) sweep data in the given timestamp range (inclusive).
    """
    with open(os.path.join(DATA_DIR, config_id, 'format'), 'r') as f:
        n = struct.unpack('I', f.read())[0]

    with open(os.path.join(DATA_DIR, config_id, 'timestamps'), 'r') as f:
        N0 = None
        N1 = 0
        while True:
            t = _fread(f, 'L')
            if t is None:
                break
            t = t[0]
            if N0 is None and t >= timestamp_0:
                N0 = N1
            if t >= timestamp_1:
                break
            N1 += 1

    with open(os.path.join(DATA_DIR, config_id, 'data'), 'r') as f:
        f.seek(N0 * n)
        for _ in xrange(N1 - N0):
            yield _fread(f, '{0}b'.format(n))


if __name__ == "__main__":
    from random import randint
    from time import time

    init('foo', 8)
    write('foo', 1000, xrange(8))
    write('foo', 1100, xrange(1, 9))
    write('foo', 1200, xrange(2, 10))
    write('foo', 1300, xrange(3, 11))
    data = list(read('foo', 1050, 1250))
    assert len(data) == 2
    assert list(data[0]) == range(1, 9)
    assert list(data[1]) == range(2, 10)

    t0 = time()
    init('bar', 200)
    for x in xrange(1000):
      write('bar', x * 100000, [randint(-128, 127) for _ in xrange(200)])
    t1 = time()
    data = list(read('bar', 0, 10000000000))
    t2 = time()
    print "{0}s to write, {1}s to read {2} sweeps".format(t1 - t0, t2 - t1, len(data))