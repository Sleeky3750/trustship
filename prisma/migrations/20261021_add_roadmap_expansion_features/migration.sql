-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING_SELLER_ACCEPTANCE', 'PENDING_PAYMENT', 'PENDING_AGREEMENT', 'PENDING_DEPOSIT', 'ESCROW_LOCKED', 'DISPATCHED', 'DELIVERED', 'RELEASED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WaybillPayer" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "DisputeFault" AS ENUM ('SELLER_FAULT', 'BUYER_FAULT');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'FINANCE');

-- CreateEnum
CREATE TYPE "LogisticsProvider" AS ENUM ('GIGL', 'SPEEDAF', 'DHL', 'CUSTOM', 'MOCK');

-- CreateEnum
CREATE TYPE "DisputeStage" AS ENUM ('AWAITING_EVIDENCE', 'IN_MEDIATION', 'ARBITRATION_PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUYER',
    "adminRole" "AdminRole" NOT NULL DEFAULT 'SUPPORT',
    "password" TEXT,
    "bankAccountName" TEXT,
    "bankVerifiedAt" TIMESTAMP(3),
    "referralCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "countryCode" TEXT NOT NULL DEFAULT 'NG',
    "paymentProvider" TEXT NOT NULL DEFAULT 'FLUTTERWAVE',
    "flwTransactionId" TEXT,
    "gatewayFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itemTitle" TEXT,
    "itemAmount" DOUBLE PRECISION NOT NULL,
    "waybillAmount" DOUBLE PRECISION NOT NULL,
    "totalEscrow" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL,
    "waybillPayer" "WaybillPayer" NOT NULL,
    "dispatchStatus" TEXT NOT NULL,
    "courierName" TEXT,
    "courierPhone" TEXT,
    "trackingNumber" TEXT,
    "logisticsProvider" "LogisticsProvider",
    "waybillUrl" TEXT,
    "deliveryStatus" TEXT,
    "disputeStage" "DisputeStage",
    "riskLevel" "RiskLevel",
    "riskScore" INTEGER,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING_SELLER_ACCEPTANCE',
    "releasePin" TEXT NOT NULL,
    "autoReleaseAt" TIMESTAMP(3),
    "termsAcceptedByBuyer" BOOLEAN NOT NULL DEFAULT false,
    "disputeFault" "DisputeFault",
    "buyerPhone" TEXT NOT NULL,
    "sellerPhone" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutQueue" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "providerRef" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeEvidence" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "uploaderPhone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "whatsappMediaId" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "tempData" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT',
    "twoFactorSecret" TEXT,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_transactionRef_key" ON "EscrowTransaction"("transactionRef");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutQueue_providerRef_key" ON "PayoutQueue"("providerRef");

-- CreateIndex
CREATE INDEX "PayoutQueue_transactionId_idx" ON "PayoutQueue"("transactionId");

-- CreateIndex
CREATE INDEX "PayoutQueue_status_idx" ON "PayoutQueue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_fromCurrency_toCurrency_key" ON "CurrencyRate"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "DisputeEvidence_transactionId_idx" ON "DisputeEvidence"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_phoneNumber_key" ON "WhatsAppSession"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookLog_eventId_key" ON "WebhookLog"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutQueue" ADD CONSTRAINT "PayoutQueue_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "EscrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

