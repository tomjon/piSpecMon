#!/bin/bash

echo "`/sbin/ifconfig`" | mail -a "From: pispecmon@gmail.com" -s `uname -n` pispecmon@gmail.com #remote.systems@ofcom.org.uk
