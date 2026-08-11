#!/bin/sh
set -eu
set +x

read_secret() {
  value="$(tr -d '\r\n' < "$1")"
  case "$value" in
    ''|*[!A-Za-z0-9_-]*)
      echo "postgres bootstrap: secret file must contain 32-128 URL-safe characters" >&2
      exit 1
      ;;
  esac
  if [ "${#value}" -lt 32 ] || [ "${#value}" -gt 128 ]; then
    echo "postgres bootstrap: secret file must contain 32-128 URL-safe characters" >&2
    exit 1
  fi
  printf '%s' "$value"
}

migrator_password="$(read_secret /run/secrets/postgres_migrator_password)"
api_password="$(read_secret /run/secrets/postgres_api_password)"
worker_password="$(read_secret /run/secrets/postgres_worker_password)"
keycloak_password="$(read_secret /run/secrets/keycloak_database_password)"

psql --no-psqlrc --set=ON_ERROR_STOP=1 --set=database_name="$POSTGRES_DB" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
\set migrator_password '$migrator_password'
\set api_password '$api_password'
\set worker_password '$worker_password'
\set keycloak_password '$keycloak_password'
CREATE ROLE hr_axis_migrator LOGIN PASSWORD :'migrator_password' NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION;
CREATE ROLE hr_axis_api LOGIN PASSWORD :'api_password' NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION;
CREATE ROLE hr_axis_worker LOGIN PASSWORD :'worker_password' NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION;
CREATE ROLE keycloak LOGIN PASSWORD :'keycloak_password' NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION;
ALTER DATABASE :"database_name" OWNER TO hr_axis_migrator;
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO hr_axis_migrator, hr_axis_api, hr_axis_worker;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM hr_axis_api, hr_axis_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator REVOKE CREATE ON SCHEMAS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator GRANT USAGE ON SCHEMAS TO hr_axis_api, hr_axis_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hr_axis_api, hr_axis_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator GRANT SELECT, USAGE ON SEQUENCES TO hr_axis_api, hr_axis_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator GRANT EXECUTE ON FUNCTIONS TO hr_axis_api, hr_axis_worker;
SELECT 'CREATE DATABASE keycloak OWNER keycloak' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
\connect keycloak
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE keycloak TO keycloak;
GRANT USAGE, CREATE ON SCHEMA public TO keycloak;
SQL

unset migrator_password api_password worker_password keycloak_password
