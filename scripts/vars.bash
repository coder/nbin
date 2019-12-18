#!/usr/bin/env bash
# vars.bash

function main() {
  cd "$(dirname "$0")"

  export NODE_VERSION=10.15.1
  export PACKAGE_VERSION=$(cat ../package.json \
                             | grep version \
                             | head -1 \
                             | awk -F: '{ print $2 }' \
                             | sed 's/[",]//g' \
                             | tr -d '[[:space:]]')
}

main "$@"
