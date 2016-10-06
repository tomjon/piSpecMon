#!/bin/bash

echo `/sbin/ifconfig` | mail -s `uname -a` remote.systems@ofcom.org.uk
