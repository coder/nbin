#!/bin/bash

set -e

./node_clone.sh
./patch_apply.sh
./webpack_build.sh
./node_build.sh
