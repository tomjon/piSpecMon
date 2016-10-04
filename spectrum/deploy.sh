#!/bin/bash

# create the version file
echo `git describe --tags` | sudo tee `python -c "import common; print common.VERSION_FILE"` >/dev/null

# build the pi_control binary
gcc -o bin/pi_control pi_control.c
sudo chown root: bin/pi_control
sudo chmod a+s bin/pi_control

# compile typescript into javascript
hash npm 2>/dev/null || {
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install nodejs
}
cd static; npm run tsc
