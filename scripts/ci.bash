#!/usr/bin/env bash
# ci.bash -- Build from CI.

set -Eeuo pipefail

function copy-binary() {
  binary_name="node-$node_version-$platform-$1"
  mkdir -p "./build/$nbin_version"
  cp ./lib/node/node "./build/$nbin_version/$binary_name"
  echo "Copied binary to ./build/$nbin_version/$binary_name"
}

function main() {
  cd "$(dirname "$0")/.."

  local nbin_version
  nbin_version=$(grep version ./package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  local arch="amd64"
  local platform="linux"
  if [[ ${OSTYPE:-} == darwin* ]] ; then
    platform="darwin"
  else
    # On Alpine there seems no way to get the version except to use an invalid
    # command which will output the version to stderr and exit with 1.
    local output
    output=$(ldd --version 2>&1 || :)
    if [[ $output == musl* ]] ; then
      platform="alpine"
    fi
    arch=$(uname -m)
  fi

  echo "Running from $(pwd)"
  ls -lA

  echo "Building $platform-$arch"
  XDG_CACHE_HOME="$(pwd)/.cache" yarn build

  local node_version
  node_version=$(NBIN_BYPASS=true ./lib/node/node --version | sed 's/^v//')

  case $arch in
    "amd64"|"x86_64") copy-binary "x86_64" ;;
    "aarch64"       ) copy-binary "arm64"  ;;
    "armv8l"        ) copy-binary "arm"    ;;
    *               ) copy-binary "$arch"  ;;
  esac
}

main "$@"
