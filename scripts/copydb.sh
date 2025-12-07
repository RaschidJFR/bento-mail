#!/bin/bash
# Copies the production database to the development database

# Fail if any var is missing
if [ -z "$SOURCE" ] || [ -z "$DESTINATION" ]; then
  echo "Usage: SOURCE=<source_uri> DESTINATION=<destination_uri> $0"
  echo ""
  exit 1
fi

mongodump --uri="$SOURCE/production" --gzip --archive=production.db.gz
mongorestore --gzip --archive=production.db.gz \
  --nsFrom="production.*" --nsTo="development.*" \
  --uri="$DESTINATION"
mongodump --uri="$SOURCE/agenda" --gzip --archive=agenda.db.gz
mongorestore --gzip --archive=agenda.db.gz \
  --nsFrom="agenda.*" --nsTo="agenda.*" \
  --uri="$DESTINATION"
  