-- Add centre-scoped SMS gateway settings. API keys are stored as authenticated ciphertext.
ALTER TABLE "CentreSettings"
ADD COLUMN "smsApiKeyEncrypted" TEXT,
ADD COLUMN "smsSenderId" TEXT;
