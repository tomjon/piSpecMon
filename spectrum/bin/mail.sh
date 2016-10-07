#!/bin/bash

echo "`/sbin/ifconfig`" | mutt -d 3 -F /home/ses/spectrum/piSpecMon/spectrum/bin/muttrc -s `uname -n` tomjon@gmail.com #remote.systems@ofcom.org.uk
