#!/bin/bash

/sbin/modprobe snd_pcm_oss
/usr/bin/amixer -c1 sset 'PCM Capture Source' 'Line'
/usr/bin/amixer -c1 sset 'Line' 80%
/usr/bin/python -u /usr/local/bin/psm-audio
