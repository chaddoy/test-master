#!/bin/sh

output=${1:-8192}
echo "max_old_space_size = $output..."
node --nouse-idle-notification --expose-gc --max_old_space_size=$output index.js
