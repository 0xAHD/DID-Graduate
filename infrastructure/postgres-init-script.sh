#!/usr/bin/env bash
# Creates databases for the Identus Cloud Agent (issuer + verifier).
#
# The Cloud Agent's Flyway migrations hardcode these role names:
#   pollux-application-user, connect-application-user, agent-application-user
# So we create them once and grant them access to all relevant databases.
set -e
set -u

# â”€â”€ Create the standard application users (idempotent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
for role in "pollux-application-user" "connect-application-user" "agent-application-user"; do
  user_exists=$(psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '$role'")
  if [ "$user_exists" != "1" ]; then
    echo "  Creating role: $role"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE USER \"$role\" WITH PASSWORD 'password';"
  else
    echo "  Role '$role' already exists, skipping."
  fi
done

# â”€â”€ Helper: create a database and grant the matching role to it â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function create_db_and_grant() {
  local database=$1    # e.g. issuer_pollux
  local base_role=$2   # e.g. pollux-application-user

  db_exists=$(psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_database WHERE datname = '$database'")
  if [ "$db_exists" != "1" ]; then
    echo "  Creating database: $database"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE DATABASE $database;"
  else
    echo "  Database '$database' already exists, skipping."
  fi

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    \c $database
    GRANT ALL PRIVILEGES ON DATABASE $database TO "$base_role";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$base_role";
EOSQL
}

# â”€â”€ Create all databases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create_db_and_grant issuer_pollux    "pollux-application-user"
create_db_and_grant issuer_connect   "connect-application-user"
create_db_and_grant issuer_agent     "agent-application-user"
create_db_and_grant verifier_pollux  "pollux-application-user"
create_db_and_grant verifier_connect "connect-application-user"
create_db_and_grant verifier_agent   "agent-application-user"
create_db_and_grant node_db          "agent-application-user"

echo "All databases and roles created successfully."
