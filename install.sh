#!/bin/bash

# compile typescript into javascript
hash npm 2>/dev/null || {
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install nodejs
}
(cd spectrum/static && npm run tsc)

# build Python egg (includes javascript built above)
sudo -H pip install -e .

# copy default config to /etc/psm.yml
sudo cp spectrum/psm.yml /etc

# function returning config values, ultimately from the YML
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

# allow server to create the secret key file
KEY_DIR=`vbl SECRET_KEY`
sudo chown $USER: `dirname $KEY_DIR`

# install the SSMTP config
hash apt-get 2>/dev/null && (
  SSMTP_CONF=`vbl SSMTP_CONF`
  sudo apt-get install ssmtp mailutils
  sudo cp spectrum/bin/ssmtp.conf $SSMTP_CONF
  sudo chown $USER: $SSMTP_CONF
)

# install the systemd service descriptors and restart services
hash systemctl 2>/dev/null && (
  cd spectrum/bin
  sudo cp psm.*.service /lib/systemd/system
  sudo systemctl daemon-reload
  sudo systemctl enable psm.*.service
  sudo systemctl restart psm.*.service
)

# install the Web API server in Apache
hash a2ensite 2>/dev/null && (
  sudo mkdir -p /var/www/psm
  sudo cp spectrum/bin/wsgi.py /var/www/psm
  sudo apt-get install libapache2-mod-wsgi
  sudo cp spectrum/bin/psm.server.conf /etc/apache2/sites-available
  sudo a2dissite 000-default
  sudo a2ensite psm.server
  sudo service apache2 restart
)

# build the pi_control binary
PI_CONTROL_PATH=`vbl PI_CONTROL_PATH`
gcc -o spectrum/bin/pi_control spectrum/pi_control.c
sudo cp spectrum/bin/pi_control $PI_CONTROL_PATH
sudo chown root: $PI_CONTROL_PATH
sudo chmod a+s $PI_CONTROL_PATH

# remind about post install steps
echo
echo "Now run psm-email to set the pispecmon email account password"
echo "and psm-users to set up the first admin account"
