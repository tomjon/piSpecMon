""" Module providing functions for tailing a log file.
"""
import os

BLOCK = 4096

def iter_tail(f, n, level='\n'):
    """ Yield the last n lines, including terminating new lines, from the file-like object, f.
    """
    f.seek(0, os.SEEK_END)
    count = 0
    check = False

    # read blocks backwards from the end of file, counting newlines
    while count <= n:
        size = min(f.tell(), BLOCK)
        if size == 0:
            break
        f.seek(-size, os.SEEK_CUR)
        chunk = f.read(size)
        if not check:
            check = True
            if level == '\n' and chunk[-1] != '\n':
                count += 1
        f.seek(-size, os.SEEK_CUR)
        count += chunk.count(level)

    # read blocks forwards from where we left off, yielding lines after adjusting for count
    line = ''
    while True:
        chunk = f.read(BLOCK)
        if len(chunk) == 0:
            if line.find(level) != -1 or level == '\n':
                yield line
            return
        line += chunk
        i = 0
        while True:
            j = line.find('\n', i)
            if j == -1:
                line = line[i:]
                break
            if line[i:j+1].find(level) != -1:
                count -= 1
                if count < n:
                    yield line[i:j+1]
            i = j + 1


if __name__ == "__main__":
    # pylint: disable=invalid-name
    import StringIO

    _f = StringIO.StringIO("""2016-10-03 10:01:44,838 - INFO - "GET /monitor HTTP/1.1" 200 -
2016-10-03 10:02:41,003 - DEBUG - No message
2016-10-03 10:03:10,123 - DEBUG - Continue
2016-10-03 10:03:12,412 - INFO - Complete""")

    lines = list(iter_tail(_f, 3))
    assert len(lines) == 3
    assert lines[0] == "2016-10-03 10:02:41,003 - DEBUG - No message\n"
    assert lines[-1] == "2016-10-03 10:03:12,412 - INFO - Complete"

    lines = list(iter_tail(_f, 2, 'INFO'))
    assert len(lines) == 2
    assert lines[0] == "2016-10-03 10:01:44,838 - INFO - \"GET /monitor HTTP/1.1\" 200 -\n"
    assert lines[-1] == "2016-10-03 10:03:12,412 - INFO - Complete"

    lines = list(iter_tail(_f, 1, 'DEBUG'))
    assert len(lines) == 1
    assert lines[0] == "2016-10-03 10:03:10,123 - DEBUG - Continue\n"
