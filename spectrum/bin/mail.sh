#!/bin/bash

echo `/sbin/ifconfig` | mutt -s `uname -n` remote.systems@ofcom.org.uk
