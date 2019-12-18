#!/usr/bin/env bash
# preinstall.bash

set -Eeuo pipefail

function main() {
  cd "$(dirname "${0}")/.."

  # Make sure submodules have been pulled.
  if [[ ! -f ./lib/node/.git ]] ; then
    echo "Could not find Node; have submodules been pulled?"
    echo "Running git submodule update --recursive --init"
    git submodule update --recursive --init

    # Ensure Node has been cloned.
    if [[ ! -f ./lib/Node/.git ]] ; then
      >&2 echo "Unable to pull Node submodule"; exit 1
    fi
  fi

  # TODO: Messes with tests?
  # rm lib/node/test/fixtures/packages/unparseable/package.json
}

main "$@"
