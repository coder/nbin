#!/bin/bash

cd "$(dirname "$0")"
source ./vars.sh
cd ../lib/node
./configure --link-module './nbin.js' --link-module './lib/_third_party_main.js'
echo -e "travis_fold:start:$1\033[33;1m$2\033[0m"
make -j2
echo -e "\ntravis_fold:end:$1\r"
cd ../../

mkdir -p ./build/$PACKAGE_VERSION
OS=${OSTYPE%-gnu}
ARCH=$(uname -p)
BINARY_NAME="node-${NODE_VERSION}-${OS}-${ARCH}"

cp ./lib/node/out/Release/node ./build/$PACKAGE_VERSION/$BINARY_NAME
