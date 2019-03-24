#!/bin/bash

set -e

cd "$(dirname "$0")"
./patch_apply.sh
./webpack_build.sh
./node_build.sh
