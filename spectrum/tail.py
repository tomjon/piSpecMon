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
