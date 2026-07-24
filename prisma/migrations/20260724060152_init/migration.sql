-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DELIVERED', 'DELAYED', 'EXCEPTION', 'IN_TRANSIT', 'CANCELED');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "carrier" TEXT NOT NULL,
    "originCity" TEXT NOT NULL,
    "destinationCity" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "sku" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceUsd" DOUBLE PRECISION NOT NULL,
    "orderValueUsd" DOUBLE PRECISION NOT NULL,
    "isPromo" BOOLEAN NOT NULL,
    "promoDiscountPct" DOUBLE PRECISION NOT NULL,
    "region" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_orderDate_idx" ON "Order"("orderDate");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_carrier_idx" ON "Order"("carrier");

-- CreateIndex
CREATE INDEX "Order_productCategory_idx" ON "Order"("productCategory");

-- CreateIndex
CREATE INDEX "Order_region_idx" ON "Order"("region");
