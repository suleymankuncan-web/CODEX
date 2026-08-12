#!/bin/sh
set -eu
umask 077

read_secret() {
  path=$1
  test -r "$path" || { echo "missing unreadable storage secret" >&2; exit 1; }
  value=$(cat "$path")
  test -n "$value" || { echo "empty storage secret" >&2; exit 1; }
  case "$value" in
    *[!A-Za-z0-9._~-]*) echo "storage secret contains unsupported characters" >&2; exit 1 ;;
  esac
  printf '%s' "$value"
}

validate_bucket() {
  value=$1
  case "$value" in
    ''|*[!a-z0-9.-]*) echo "invalid storage bucket" >&2; exit 1 ;;
  esac
}

primary_bucket=${PHOTO_MEDIA_PRIMARY_BUCKET:?missing primary bucket}
recovery_bucket=${PHOTO_MEDIA_RECOVERY_BUCKET:?missing recovery bucket}
validate_bucket "$primary_bucket"
validate_bucket "$recovery_bucket"
test "$primary_bucket" != "$recovery_bucket" || { echo "primary/recovery buckets must differ" >&2; exit 1; }

primary_key=$(read_secret "${PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE:?missing primary access key file}")
primary_secret=$(read_secret "${PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY_FILE:?missing primary secret file}")
recovery_key=$(read_secret "${PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID_FILE:?missing recovery access key file}")
recovery_secret=$(read_secret "${PHOTO_MEDIA_RECOVERY_SECRET_ACCESS_KEY_FILE:?missing recovery secret file}")
test "$primary_key" != "$recovery_key" || { echo "primary/recovery credentials must differ" >&2; exit 1; }

config=/run/seaweed/s3-config.json
mkdir -p "$(dirname "$config")"
cat > "$config" <<EOF
{
  "identities": [
    {"name": "primary", "credentials": [{"accessKey": "$primary_key", "secretKey": "$primary_secret"}], "actions": ["Admin:$primary_bucket"]},
    {"name": "recovery", "credentials": [{"accessKey": "$recovery_key", "secretKey": "$recovery_secret"}], "actions": ["Admin:$recovery_bucket"]}
  ]
}
EOF
chmod 0400 "$config"
chown 1000:1000 "$config"
chmod 0700 "$(dirname "$config")"
chown 1000:1000 "$(dirname "$config")"
unset primary_key primary_secret recovery_key recovery_secret

exec /entrypoint.sh server \
  -ip=object-storage \
  -ip.bind=0.0.0.0 \
  -s3.ip.bind=0.0.0.0 \
  -volume.max=32 \
  -master.telemetry=false \
  -filer.exposeDirectoryData=false \
  -filer.ui.deleteDir=false \
  -s3 \
  -s3.config=/run/seaweed/s3-config.json \
  -s3.iam=false \
  -s3.allowDeleteBucketNotEmpty=false \
  -s3.allowedOrigins=http://object-storage:8333 \
  -s3.concurrentFileUploadLimit=4 \
  -s3.concurrentUploadLimitMB=32 \
  "$@"
