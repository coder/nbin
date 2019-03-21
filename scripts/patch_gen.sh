#!/bin/bash

cd "$(dirname "$0")"
cd ../lib/node
git diff -w -- lib/module.js lib/bootstrap_node.js --unified=0 > ../../scripts/node.patch
