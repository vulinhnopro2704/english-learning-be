ALTER TABLE "auth"."User"
ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(6),
ADD COLUMN "emailVerificationTokenHash" TEXT,
ADD COLUMN "emailVerificationSentAt" TIMESTAMPTZ(6),
ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetSentAt" TIMESTAMPTZ(6);

CREATE INDEX "User_emailVerificationTokenHash_idx" ON "auth"."User"("emailVerificationTokenHash");
CREATE INDEX "User_passwordResetTokenHash_idx" ON "auth"."User"("passwordResetTokenHash");
