#!/bin/bash

set -e

cd "$(dirname "$0")"
./node_clone.sh
./patch_apply.sh
./webpack_build.sh
./node_build.sh
