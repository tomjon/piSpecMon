""" Parse config in YAML format. Starts with the default config file, then applies
    settings from any .yml paths found on the command line.
"""
import sys
import yaml
import Hamlib

CONFIG_FILE = '/etc/psm.yml'

# load configuration settings from the YML file at the given path, converting keys
# to upper case and concatenating keys from the top two levels of dictionaries
# (so you can't have dictionaries for values at the top level)
def _load_settings(path):
    def _setattr(key, value):
        setattr(sys.modules[__name__], key.upper(), value)

    with open(path) as f:
        config = yaml.load(f)
        for key, value in config.iteritems():
            if isinstance(value, dict):
                for key2, value2 in value.iteritems():
                    _setattr('_'.join((key, key2)), value2)
            else:
                _setattr(key, value)

# load settings from any YML files specified on the command line (overriding previous)
def _parse_args():
    for arg in sys.argv:
        if arg.endswith('.yml'):
            _load_settings(arg)

_load_settings(CONFIG_FILE)
_parse_args()

# set the default rig model based on whether the PSM test model is available in Hamlib
# pylint: disable=undefined-variable
if not DEFAULT_RIG_SETTINGS.get('model', None):
    try:
        DEFAULT_RIG_SETTINGS['model'] = Hamlib.RIG_MODEL_PSMTEST
    except AttributeError:
        DEFAULT_RIG_SETTINGS['model'] = Hamlib.RIG_MODEL_AR8200
