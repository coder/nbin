#!/bin/bash

set -euox pipefail

cd "$(dirname "$0")"
source ./vars.sh

./patch_apply.sh
./webpack_build.sh

cp ./node_build.sh ../lib/node/build.sh
mkdir -p ./build/$PACKAGE_VERSION

if [[ "$OSTYPE" == "darwin"* ]]; then
	./mac_build.sh
else
	./docker_build.sh
fi
