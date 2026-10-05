#!/usr/bin/env bash
# Runs once when MariaDB initializes its data directory.
# Creates the wp_club database (wp_breeder is created by MARIADB_DATABASE env var)
# and grants the wp user full access to both.
set -e

mysql -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS wp_breeder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS wp_club    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON wp_breeder.* TO 'wp'@'%';
GRANT ALL PRIVILEGES ON wp_club.*    TO 'wp'@'%';
FLUSH PRIVILEGES;
SQL
