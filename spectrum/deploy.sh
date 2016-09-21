#!/bin/bash

# create the version file
echo `git describe --tags` | sudo tee /version >/dev/null

# compile typescript into javascript
hash npm 2>/dev/null || {
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install nodejs
}
cd static; npm run tsc
