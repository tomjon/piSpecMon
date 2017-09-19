""" Process management module. Use this to provide a process which responds to signals and reads
    config and writes status using the file system, and writes data to the provided data source.
"""
import json
import os
import signal
import errno
import sys
import traceback
from spectrum.common import log, now
from spectrum.datastore import StoreError
from spectrum.config import PID_KILL_PATH, RUN_PATH, CONFIG_PATH

def kill(pid, signum):
    cmd = "{0} {1} {2}".format(PID_KILL_PATH, signum, pid)
    r = os.system(cmd) >> 8
    if r == 255:
        raise ProcessError("Bad command: {0}".format(cmd))
    if r != 0:
        e = OSError(cmd)
        e.errno = r
        raise e

class Process(object):
    """ Start the process with start(), after supplying the data store, pid file,
        config file and status file names.

        Sub-classes may need to override get_capabilities().
    """
    def __init__(self, data_store, prefix=None, run_path=None, config_file=None):
        self.data_store = data_store
        self.prefix = prefix
        if run_path is None: # allow for run path override, otherwise use pattern
            run_path = RUN_PATH.replace('$', prefix)
        try:
            os.makedirs(run_path)
        except OSError:
            pass
        self.pid_file = os.path.join(run_path, 'pid')
        self.status_file = os.path.join(run_path, 'status')
        self.caps_file = os.path.join(run_path, 'caps')
        if config_file is None: # allow for config override, otherwise use pattern
            self.config_file = CONFIG_PATH.replace('$', prefix)
        else:
            self.config_file = config_file
        self._exit = False
        self._stop = False
        self._tidy = False
        self.config_id = None
        self.status = {}

    def get_capabilities(self):
        return {}

    def write_caps(self):
        log.debug("Writing caps file: %s", self.caps_file)
        tmp = self.caps_file + '_tmp'
        with open(tmp, 'w') as f:
            f.write(json.dumps(self.get_capabilities()))
        os.rename(tmp, self.caps_file)

    def read_pid(self):
        """ Read and verify the PID file.
        """
        if not os.path.isfile(self.pid_file):
            return None
        try:
            with open(self.pid_file) as f:
                pid = f.read().strip()
            pid = int(pid)
            kill(pid, 0)
            return pid
        except IOError:
            raise ProcessError("Can not open PID file: {0}".format(self.pid_file))
        except ValueError:
            raise ProcessError("Bad PID: {0}".format(pid))
        except OSError as e:
            raise ProcessError("Bad PID ({0}): {1}".format(errno.errorcode[e.errno], pid))

    # write status to the status file
    def _write_status(self):
        self.status['config_id'] = self.config_id
        log.debug("Writing status %s", json.dumps(self.status))
        tmp = self.status_file + '_tmp'
        with open(tmp, 'w') as f:
            f.write(json.dumps(self.status))
        os.rename(tmp, self.status_file)

    # define signal handler for given signal in order to exit cleanly
    def _set_signal(self, signame, stop=True, exit=False, tidy=False): # pylint: disable=redefined-builtin
        def _callback(*_):
            self._stop = stop
            self._exit = exit
            self._tidy = tidy
        signal.signal(getattr(signal, signame), _callback)

    # read the config file
    def _read_config(self):
        if not os.path.isfile(self.config_file):
            return None
        with open(self.config_file) as f:
            return f.read().strip()

    def open(self):
        pass

    def close(self):
        pass

    def start(self):
        """ Start the process, writing status yielded by iterator.
        """
        log.info("STARTING")
        self.write_caps()
        self.open()
        try:
            while True:
                self.config_id = self._read_config()
                if self.config_id is not None:
                    log.debug("Read config id %s", self.config_id)
                    try:
                        config = self.data_store.config(self.config_id).read()
                    except StoreError as e:
                        log.error("No config for id: %s", self.config_id)
                        os.remove(self.config_file)
                    else:
                        log.debug("Running with config: %s", json.dumps(config.values))
                        self._stop = False
                        self.status.clear()
                        try:
                            for _ in self.iterator(config):
                                self._write_status()
                                if self._stop:
                                    break
                        except BaseException as e: # pylint: disable=broad-except
                            log.exception(e)
                            config.write_error(now(), e)
                if os.path.isfile(self.status_file):
                    os.remove(self.status_file)
                if self._tidy and os.path.isfile(self.config_file):
                    os.remove(self.config_file)
                if self._exit:
                    break
                signal.pause()
        finally:
            log.info("STOPPING")
            os.remove(self.pid_file)
            if os.path.isfile(self.status_file):
                os.remove(self.status_file)
            self.close()

    def stop(self):
        """ Stop the process.
        """
        self._stop = True

    def init(self):
        """ Initialise the process.
        """
        try:
            pid = self.read_pid()
            if pid is not None:
                log.error("Process already exists: %s", pid)
                sys.exit(1)
        except ProcessError:
            pass
        with open(self.pid_file, 'w') as f:
            f.write(str(os.getpid()))

        self._set_signal('SIGTERM', exit=True)
        self._set_signal('SIGINT', exit=True)
        self._set_signal('SIGHUP', exit=True)
        self._set_signal('SIGUSR1', tidy=True)

    def client(self):
        """ Return a client for the process.
        """
        return Client(self)

    def iterator(self, _): # pylint: disable=no-self-use
        """ Sub-classes should implement.
        """
        return
        yield # pylint: disable=unreachable


class Client(object):
    """ Client class used to read status and PID files from other processes.
    """
    def __init__(self, process):
        self.process = process
        self.prefix = process.prefix
        self.pid = None
        self.error = None

    def read_pid(self):
        """ Read and return the process PID.
        """
        try:
            self.pid = self.process.read_pid()
            self.error = None
        except ProcessError as e:
            self.error = e.message
        if self.pid is None and self.error is None:
            self.error = "No {0} process".format(self.process.__class__.__name__.lower())
        return self.pid

    def get_capabilities(self):
        """ Read the caps file to report capabilities.
        """
        if not os.path.isfile(self.process.caps_file):
            return None
        with open(self.process.caps_file) as f:
            return json.loads(f.read())

    def status(self):
        """ Read and return the process status.
        """
        self.read_pid()

        if not os.path.isfile(self.process.status_file):
            status = {}
        else:
            stat = os.stat(self.process.status_file)
            with open(self.process.status_file, 'r') as f:
                status = json.loads(f.read())
            status['timestamp'] = int(1000 * stat.st_mtime)
        if self.error is not None:
            status['error'] = self.error
        return status

    def start(self, config_id):
        """ Tell the process to start processing the specified config id.
        """
        if self.read_pid() is not None:
            with open(self.process.config_file, 'w') as f:
                f.write(config_id)
            kill(self.pid, signal.SIGUSR1)

    def stop(self):
        """ Tell the process to stop processing.
        """
        if self.read_pid() is not None:
            kill(self.pid, signal.SIGUSR1)

    def exit(self, tidy=True):
        """ Tell the process to exit.
        """
        if self.read_pid() is not None:
            kill(self.pid, signal.SIGINT if tidy else signal.SIGTERM)


class ProcessError(Exception):
    """ Class for process specific exceptions.
    """
    def __init__(self, message):
        super(ProcessError, self).__init__()
        self.message = message
