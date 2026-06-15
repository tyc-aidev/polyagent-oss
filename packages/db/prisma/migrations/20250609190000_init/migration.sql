-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paused',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION NOT NULL,
    "costBasis" DOUBLE PRECISION NOT NULL,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotTick" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionsCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BotTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPriceSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "yesPrice" DOUBLE PRECISION NOT NULL,
    "noPrice" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tickId" TEXT,

    CONSTRAINT "MarketPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPriceSnapshot_marketId_capturedAt_idx" ON "MarketPriceSnapshot"("marketId", "capturedAt");

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotTick" ADD CONSTRAINT "BotTick_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPriceSnapshot" ADD CONSTRAINT "MarketPriceSnapshot_tickId_fkey" FOREIGN KEY ("tickId") REFERENCES "BotTick"("id") ON DELETE SET NULL ON UPDATE CASCADE;