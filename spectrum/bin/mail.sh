#!/bin/bash

while ! ping -c1 smtp.gmail.com &>/dev/null; do sleep 2; done
echo "`/sbin/ifconfig`" | mail -a "From: pispecmon@gmail.com" -s `uname -n; date` -c pispecmon@gmail.com remote.systems@ofcom.org.uk
