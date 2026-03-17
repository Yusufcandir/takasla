#!/bin/sh
# Automated database backup script
# Runs via cron inside the db-backup container every 6 hours
# Dumps all 10 PostgreSQL databases, gzip-compresses, rotates after 7 days

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

echo "=== Starting database backup at $(date) ==="

DATABASES="
auth_db:postgres-auth:AUTH_DB_PASSWORD
user_db:postgres-user:USER_DB_PASSWORD
listing_db:postgres-listing:LISTING_DB_PASSWORD
offer_db:postgres-offer:OFFER_DB_PASSWORD
trade_db:postgres-trade:TRADE_DB_PASSWORD
reputation_db:postgres-reputation:REPUTATION_DB_PASSWORD
dispute_db:postgres-dispute:DISPUTE_DB_PASSWORD
certificate_db:postgres-certificate:CERTIFICATE_DB_PASSWORD
shipping_db:postgres-shipping:SHIPPING_DB_PASSWORD
payment_db:postgres-payment:PAYMENT_DB_PASSWORD
messaging_db:postgres-messaging:MESSAGING_DB_PASSWORD
"

SUCCESS=0
FAIL=0

for entry in $DATABASES; do
  DB_NAME=$(echo "$entry" | cut -d: -f1)
  DB_HOST=$(echo "$entry" | cut -d: -f2)
  PW_VAR=$(echo "$entry" | cut -d: -f3)
  PW=$(eval echo "\$$PW_VAR")

  OUTFILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
  echo "  Backing up ${DB_NAME} from ${DB_HOST}..."

  PGPASSWORD="$PW" pg_dump -h "$DB_HOST" -U exchange -d "$DB_NAME" | gzip > "$OUTFILE"

  if [ $? -eq 0 ] && [ -s "$OUTFILE" ]; then
    SIZE=$(du -h "$OUTFILE" | cut -f1)
    echo "  OK: ${OUTFILE} (${SIZE})"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  FAILED: ${DB_NAME}"
    rm -f "$OUTFILE"
    FAIL=$((FAIL + 1))
  fi
done

# Rotate old backups
echo "  Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "=== Backup complete: ${SUCCESS} succeeded, ${FAIL} failed ==="
