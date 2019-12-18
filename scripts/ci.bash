#!/usr/bin/env bash
# ci.bash

set -Eeuo pipefail

function main() {
  cd "$(dirname "$0")/.."

  if ! yarn patch:apply 2> /dev/null ; then
    echo "Failed to patch; assuming already patched"
  fi

  # cp ./node_build.sh ../lib/node/build.sh
  # mkdir -p "../build/$PACKAGE_VERSION"
  # rm ../lib/node/test/fixtures/packages/unparseable/package.json

  # if [[ $OSTYPE == "darwin"* ]]; then
  #   ./mac_build.sh
  # else
  #   ./docker_build.sh
  # fi
}

main "$@"
