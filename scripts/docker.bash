#!/usr/bin/env bash
# docker.bash -- Optionally build and push each Docker image.

set -Eeuo pipefail

function build() {
  local name=$1 ; shift
  local dockerfile="$name.dockerfile"
  local image="codercom/nbin-$name"
  local yn

  read -r -p "Build $image? (y/n) " yn
  if [[ $yn == "y" ]] ; then
    docker build --network=host -f "$dockerfile" -t "$image" -t "$image:$version" ..
  fi

  read -r -p "Push $image? (y/n) " yn
  if [[ $yn == "y" ]] ; then
    docker push "$image"
  fi

  read -r -p "Push $image:$version? (y/n) " yn
  if [[ $yn == "y" ]] ; then
    docker push "$image:$version"
  fi
}

function main() {
  cd "$(dirname "$0")"

  local version
  version=$(grep version ../package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]')

  # If there are command line arguments, use those. Otherwise loop through all
  # the existing dockerfiles.
  if [[ -n "${1:-}" ]] ; then
    local name="$1" ; shift
    build "$name"
  else
    for dockerfile in *.dockerfile ; do
      local name="${dockerfile%.dockerfile}"
      build "$name"
    done
  fi
}

main "$@"
