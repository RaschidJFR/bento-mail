#!/bin/bash
# Copies the production database to the development database

# Fail if any var is missing
if [ -z "$SOURCE" ] || [ -z "$DESTINATION" ]; then
  echo "Usage: SOURCE=<source_uri> DESTINATION=<destination_uri> $0"
  echo ""
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d%H%M%S")
DB_FILE="production_$TIMESTAMP.db.gz"
AGENDA_FILE="agenda_$TIMESTAMP.db.gz"

mongodump --uri="$SOURCE/production" --gzip --archive=$DB_FILE
mongorestore --gzip --archive=$DB_FILE \
  --nsFrom="production.*" --nsTo="development.*" \
  --uri="$DESTINATION"
rm $DB_FILE

mongodump --uri="$SOURCE/agenda" --gzip --archive=$AGENDA_FILE
mongorestore --gzip --archive=$AGENDA_FILE \
  --nsFrom="agenda.*" --nsTo="agenda.*" \
  --uri="$DESTINATION"
rm $AGENDA_FILE
  