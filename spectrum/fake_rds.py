""" Fake RDS API module for local test.
"""

from time import time
from random import choice

STRENGTH_DELAY = 2
NAME_DELAY = 4
TEXT_DELAY = 6

STRENGTH = 80

VALUES = {
    91.4: {'name': "Radio 3", 'text': ["Beethoven - Moonlight Sonata", "Holst - Jupiter"]},
    96.1: {'name': "Kiss FM", 'text': ["Chart Hits", "Top Requests", "Music with Phil Peters"]},
    100.0: {'name': "Classic FM", 'text': ["Mendelssohn: Wedding March"]}
}


class RdsApi(object):
    """ Fake RDS API implementation.
    """

    def __init__(self, *_):
        self.mhz = None
        self.t0 = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def _delay(self, delay, value, default=None):
        return value if time() > self.t0 + delay else default

    def set_frequency(self, freq):
        """ Set RDS decode frequency.
        """
        self.mhz = round(freq / 1E6, 1)
        self.t0 = time()

    def get_strength(self):
        """ Read the signal strength.
        """
        if self.mhz not in VALUES:
            return 0
        return self._delay(STRENGTH_DELAY, STRENGTH, 0)

    def get_name(self):
        """ Read the decoded RDS name string.
        """
        if self.mhz not in VALUES:
            return ""
        return self._delay(NAME_DELAY, VALUES[self.mhz]['name'])

    def get_text(self):
        """ Read the decoded RDS text string.
        """
        if self.mhz not in VALUES:
            return ""
        text = self._delay(TEXT_DELAY, choice(VALUES[self.mhz]['text']))
        if text is not None:
            self.t0 = time()
        return text
