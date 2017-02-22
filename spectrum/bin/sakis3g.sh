#!/bin/bash

ID=`lsusb -d 12d1: | egrep -o [0-9a-f]{4}:[0-9a-f]{4}`
echo Detected $ID
/usr/local/bin/sakis3g "$1" "OTHER=USBMODEM" "USBMODEM=$ID" "APN=3internet"

