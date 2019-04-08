#!/bin/bash

cd "$(dirname "$0")"
cd ..
rm lib/node/test/fixtures/packages/unparseable/package.json
npm run test
