#!/bin/bash

(cd .. && sudo -H pip install -e .)

function vbl {
  echo `python -c "import spectrum.config; print spectrum.config.$1"`
}

# create the version file
echo `git describe --tags` | sudo tee `vbl VERSION_FILE` >/dev/null

# create the log directory
LOG_PATH=`vbl LOG_PATH`
sudo mkdir -p $LOG_PATH
sudo chown $USER: $LOG_PATH

# create the data directory
DATA_PATH=`vbl DATA_PATH`
sudo mkdir -p $DATA_PATH
sudo chown $USER: $DATA_PATH

# create the worker run directory
RUN_PATH=`vbl WORKER_RUN_PATH`
sudo mkdir -p $RUN_PATH
sudo chown $USER: $RUN_PATH

# create the monkey run directory
RUN_PATH=`vbl MONKEY_RUN_PATH`
sudo mkdir -p $RUN_PATH
sudo chown $USER: $RUN_PATH

# build the pi_control binary
PI_CONTROL_PATH=`vbl PI_CONTROL_PATH`
gcc -o bin/pi_control pi_control.c
sudo cp bin/pi_control $PI_CONTROL_PATH
sudo chown root: $PI_CONTROL_PATH
sudo chmod a+s $PI_CONTROL_PATH

# compile typescript into javascript
hash npm 2>/dev/null || {
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install nodejs
}
cd static; npm run tsc
