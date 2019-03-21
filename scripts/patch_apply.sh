#!/bin/bash

cd "$(dirname "$0")"
cd ../lib/node
git apply --unidiff-zero --ignore-space-change ../../node.patch
