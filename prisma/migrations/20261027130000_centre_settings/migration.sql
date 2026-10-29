CREATE TABLE "CentreSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL DEFAULT 'MediCore Diagnostics',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT,
  CONSTRAINT "CentreSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CentreSettings" ("id", "name")
VALUES ('default', 'MediCore Diagnostics')
ON CONFLICT ("id") DO NOTHING;
