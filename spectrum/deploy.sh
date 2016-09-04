#!/bin/bash
hash npm 2>/dev/null || {
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install nodejs
}
cd static; npm run tsc
