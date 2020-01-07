#!/usr/bin/env bash
# node_build.bash

set -Eeuo pipefail

function main() {
  cd "$(dirname "$0")/../lib/node"

  if [[ ! -f ../../out/patches/thirdPartyMain.js ]] ; then
    >&2 echo "Must build nbin before building Node"; exit 1
  fi

  cp ../../out/patches/thirdPartyMain.js ./lib/_third_party_main.js

  if ! git apply ../../scripts/node.patch ; then
    echo "Failed to patch; assuming already patched"
  fi

  local -i cores=2
  export CC="ccache gcc"
  export CXX="ccache g++"
  if [[ -n ${XDG_CACHE_HOME:-} ]] ; then
    export CCACHE_DIR="$XDG_CACHE_HOME/ccache"
  elif [[ $OSTYPE == "darwin"* ]]; then
    export CCACHE_DIR="$HOME/Library/Caches/ccache"
  else
    export CCACHE_DIR="$HOME/.cache/ccache"
    cores=$(awk '/^processor/{print $3}' /proc/cpuinfo | wc -l)
  fi

  echo "ccache directory: $CCACHE_DIR"
  echo "cores: $cores"

  ./configure \
    --dest-cpu=x64 \
    --link-module ./lib/nbin.js \
    --link-module ./lib/_third_party_main.js \
    --openssl-no-asm --openssl-use-def-ca-store

  make "-j$cores"
}

main "$@"
