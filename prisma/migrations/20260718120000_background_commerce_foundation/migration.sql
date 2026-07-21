CREATE TYPE "CommerceOrderStatus" AS ENUM ('PREPARING', 'AWAITING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELED', 'EXPIRED', 'REVIEW_REQUIRED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "CommercePaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "CommerceFulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'REVOKED');
CREATE TYPE "CommerceRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "CommerceDisputeStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "BackgroundOwnershipSource" AS ENUM ('PURCHASE', 'CREDIT_REDEMPTION');
CREATE TYPE "BackgroundOwnershipStatus" AS ENUM ('ACTIVE', 'REFUND_PENDING', 'DISPUTE_SUSPENDED', 'REFUND_REVOKED', 'DISPUTE_REVOKED', 'RETIRED');
CREATE TYPE "BackgroundCreditEntryType" AS ENUM ('INITIAL_GRANT', 'REDEMPTION', 'RETIREMENT_REPLACEMENT', 'ADMIN_CORRECTION');

CREATE TABLE "CommerceCart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceCart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceCartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "productKey" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceCartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceCartItem_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE "CommerceOrder" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PREPARING',
  "fulfillmentStatus" "CommerceFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotalCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "reservationExpiresAt" TIMESTAMP(3),
  "legalAcceptance" JSONB NOT NULL DEFAULT '{}',
  "purchaseCountry" TEXT,
  "returnPath" TEXT NOT NULL,
  "failureCode" TEXT,
  "fulfillmentStartedAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceOrder_totals_nonnegative" CHECK ("subtotalCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0)
);

CREATE TABLE "CommerceOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "productKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "allocatedTaxCents" INTEGER NOT NULL,
  "lineTotalCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "fulfillmentAdapterVersion" TEXT NOT NULL,
  "fulfillmentStatus" "CommerceFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceOrderItem_money_nonnegative" CHECK ("unitPriceCents" >= 0 AND "quantity" > 0 AND "allocatedTaxCents" >= 0 AND "lineTotalCents" >= 0)
);

CREATE TABLE "CommercePayment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "CommercePaymentStatus" NOT NULL DEFAULT 'PENDING',
  "stripePaymentIntentId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "failureCode" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercePayment_amount_nonnegative" CHECK ("amountCents" >= 0)
);

CREATE TABLE "CommerceRefund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "stripeRefundId" TEXT NOT NULL,
  "status" "CommerceRefundStatus" NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "reasonCode" TEXT,
  "failureCode" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceRefund_amount_nonnegative" CHECK ("amountCents" >= 0)
);

CREATE TABLE "CommerceRefundItem" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "amountCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceRefundItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceRefundItem_amount_nonnegative" CHECK ("quantity" > 0 AND "amountCents" >= 0)
);

CREATE TABLE "CommerceDispute" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "stripeDisputeId" TEXT NOT NULL,
  "status" "CommerceDisputeStatus" NOT NULL DEFAULT 'OPEN',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "reasonCode" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceDispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceDispute_amount_nonnegative" CHECK ("amountCents" >= 0)
);

CREATE TABLE "CommerceEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "actorType" TEXT,
  "actorId" TEXT,
  "reasonCode" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "fromState" TEXT,
  "toState" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceWebhookReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "orderId" TEXT,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  CONSTRAINT "CommerceWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackgroundCreditWallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackgroundCreditWallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackgroundCreditWallet_balance_nonnegative" CHECK ("balance" >= 0),
  CONSTRAINT "BackgroundCreditWallet_version_nonnegative" CHECK ("version" >= 0)
);

CREATE TABLE "BackgroundCreditEntry" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" "BackgroundCreditEntryType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sourceOrderItemId" TEXT,
  "reasonCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackgroundCreditEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackgroundCreditEntry_balance_after_nonnegative" CHECK ("balanceAfter" >= 0),
  CONSTRAINT "BackgroundCreditEntry_redemption_delta_negative" CHECK ("type" <> 'REDEMPTION' OR "delta" < 0)
);

CREATE TABLE "BackgroundOwnership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "backgroundKey" TEXT NOT NULL,
  "source" "BackgroundOwnershipSource" NOT NULL,
  "status" "BackgroundOwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceOrderItemId" TEXT,
  "sourceCreditEntryId" TEXT,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackgroundOwnership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackgroundOwnership_exactly_one_source" CHECK (("sourceOrderItemId" IS NOT NULL) <> ("sourceCreditEntryId" IS NOT NULL)),
  CONSTRAINT "BackgroundOwnership_source_matches_reference" CHECK (
    ("source" = 'PURCHASE' AND "sourceOrderItemId" IS NOT NULL AND "sourceCreditEntryId" IS NULL)
    OR ("source" = 'CREDIT_REDEMPTION' AND "sourceOrderItemId" IS NULL AND "sourceCreditEntryId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "CommerceCart_userId_key" ON "CommerceCart"("userId");
CREATE UNIQUE INDEX "CommerceCartItem_cartId_productType_productKey_key" ON "CommerceCartItem"("cartId", "productType", "productKey");

CREATE UNIQUE INDEX "CommerceOrder_publicId_key" ON "CommerceOrder"("publicId");
CREATE UNIQUE INDEX "CommerceOrder_stripeCheckoutSessionId_key" ON "CommerceOrder"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "CommerceOrder_one_active_per_user_key"
  ON "CommerceOrder"("userId")
  WHERE "status" IN ('PREPARING', 'AWAITING_PAYMENT');
CREATE INDEX "CommerceOrder_userId_createdAt_idx" ON "CommerceOrder"("userId", "createdAt");
CREATE INDEX "CommerceOrder_status_reservationExpiresAt_idx" ON "CommerceOrder"("status", "reservationExpiresAt");

CREATE UNIQUE INDEX "CommerceOrderItem_orderId_productType_productKey_key" ON "CommerceOrderItem"("orderId", "productType", "productKey");
CREATE INDEX "CommerceOrderItem_productType_productKey_idx" ON "CommerceOrderItem"("productType", "productKey");

CREATE UNIQUE INDEX "CommercePayment_stripePaymentIntentId_key" ON "CommercePayment"("stripePaymentIntentId");
CREATE INDEX "CommercePayment_orderId_status_idx" ON "CommercePayment"("orderId", "status");

CREATE UNIQUE INDEX "CommerceRefund_stripeRefundId_key" ON "CommerceRefund"("stripeRefundId");
CREATE INDEX "CommerceRefund_orderId_status_idx" ON "CommerceRefund"("orderId", "status");
CREATE INDEX "CommerceRefund_paymentId_status_idx" ON "CommerceRefund"("paymentId", "status");
CREATE UNIQUE INDEX "CommerceRefundItem_refundId_orderItemId_key" ON "CommerceRefundItem"("refundId", "orderItemId");
CREATE INDEX "CommerceRefundItem_orderItemId_idx" ON "CommerceRefundItem"("orderItemId");

CREATE UNIQUE INDEX "CommerceDispute_stripeDisputeId_key" ON "CommerceDispute"("stripeDisputeId");
CREATE INDEX "CommerceDispute_paymentId_status_idx" ON "CommerceDispute"("paymentId", "status");

CREATE INDEX "CommerceEvent_userId_createdAt_idx" ON "CommerceEvent"("userId", "createdAt");
CREATE INDEX "CommerceEvent_aggregateType_aggregateId_createdAt_idx" ON "CommerceEvent"("aggregateType", "aggregateId", "createdAt");
CREATE INDEX "CommerceEvent_orderId_createdAt_idx" ON "CommerceEvent"("orderId", "createdAt");

CREATE UNIQUE INDEX "CommerceWebhookReceipt_provider_providerEventId_key" ON "CommerceWebhookReceipt"("provider", "providerEventId");
CREATE INDEX "CommerceWebhookReceipt_userId_receivedAt_idx" ON "CommerceWebhookReceipt"("userId", "receivedAt");
CREATE INDEX "CommerceWebhookReceipt_orderId_receivedAt_idx" ON "CommerceWebhookReceipt"("orderId", "receivedAt");

CREATE UNIQUE INDEX "BackgroundCreditWallet_userId_key" ON "BackgroundCreditWallet"("userId");
CREATE UNIQUE INDEX "BackgroundCreditEntry_idempotencyKey_key" ON "BackgroundCreditEntry"("idempotencyKey");
CREATE INDEX "BackgroundCreditEntry_walletId_createdAt_idx" ON "BackgroundCreditEntry"("walletId", "createdAt");
CREATE INDEX "BackgroundCreditEntry_sourceOrderItemId_idx" ON "BackgroundCreditEntry"("sourceOrderItemId");

CREATE UNIQUE INDEX "BackgroundOwnership_sourceOrderItemId_key" ON "BackgroundOwnership"("sourceOrderItemId");
CREATE UNIQUE INDEX "BackgroundOwnership_sourceCreditEntryId_key" ON "BackgroundOwnership"("sourceCreditEntryId");
CREATE UNIQUE INDEX "BackgroundOwnership_userId_backgroundKey_key" ON "BackgroundOwnership"("userId", "backgroundKey");
CREATE INDEX "BackgroundOwnership_userId_status_idx" ON "BackgroundOwnership"("userId", "status");
CREATE INDEX "BackgroundOwnership_backgroundKey_status_idx" ON "BackgroundOwnership"("backgroundKey", "status");

ALTER TABLE "CommerceCart" ADD CONSTRAINT "CommerceCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceCartItem" ADD CONSTRAINT "CommerceCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "CommerceCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceRefund" ADD CONSTRAINT "CommerceRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceRefund" ADD CONSTRAINT "CommerceRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceRefundItem" ADD CONSTRAINT "CommerceRefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "CommerceRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceRefundItem" ADD CONSTRAINT "CommerceRefundItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "CommerceOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceDispute" ADD CONSTRAINT "CommerceDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceEvent" ADD CONSTRAINT "CommerceEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceWebhookReceipt" ADD CONSTRAINT "CommerceWebhookReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceWebhookReceipt" ADD CONSTRAINT "CommerceWebhookReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BackgroundCreditWallet" ADD CONSTRAINT "BackgroundCreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackgroundCreditEntry" ADD CONSTRAINT "BackgroundCreditEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BackgroundCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackgroundCreditEntry" ADD CONSTRAINT "BackgroundCreditEntry_sourceOrderItemId_fkey" FOREIGN KEY ("sourceOrderItemId") REFERENCES "CommerceOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BackgroundOwnership" ADD CONSTRAINT "BackgroundOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackgroundOwnership" ADD CONSTRAINT "BackgroundOwnership_sourceOrderItemId_fkey" FOREIGN KEY ("sourceOrderItemId") REFERENCES "CommerceOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackgroundOwnership" ADD CONSTRAINT "BackgroundOwnership_sourceCreditEntryId_fkey" FOREIGN KEY ("sourceCreditEntryId") REFERENCES "BackgroundCreditEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
