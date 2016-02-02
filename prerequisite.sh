#!/bin/sh

#temporary fix
cd test/data
git clone https://github.com/School-Improvement-Network/observation-public-tests.git
cd observation-public-tests
npm install
cd ../..
npm install
