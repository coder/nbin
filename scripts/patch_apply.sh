#!/bin/bash

cd "$(dirname "$0")"
cd ../lib/node
git apply --unidiff-zero ../../node.patch
