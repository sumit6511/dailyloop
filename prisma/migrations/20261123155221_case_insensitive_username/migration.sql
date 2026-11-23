-- Case-insensitive usernames. citext is a trusted extension (PostgreSQL 13+), so a database
-- owner can create it without superuser rights.
CREATE EXTENSION IF NOT EXISTS citext;

-- If two existing users differ only by case (e.g. "Harry" and "harry"), this fails on the unique
-- index — rename one of them first:
--   SELECT lower(username), array_agg(username) FROM "User" GROUP BY 1 HAVING count(*) > 1;
ALTER TABLE "User" ALTER COLUMN "username" SET DATA TYPE CITEXT;
