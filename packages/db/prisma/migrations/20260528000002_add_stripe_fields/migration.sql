-- Add stripeCustomerId to users
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- Add stripePriceId to subscription_plans
ALTER TABLE "subscription_plans" ADD COLUMN "stripePriceId" TEXT;
