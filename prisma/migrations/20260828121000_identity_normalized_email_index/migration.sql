CREATE UNIQUE INDEX CONCURRENTLY "User_normalized_email_key"
  ON "User" (lower(btrim("email"))) WHERE "email" IS NOT NULL;
