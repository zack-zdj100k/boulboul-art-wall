-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'MADE_TO_ORDER', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'PER_METER');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomOrderStatus" AS ENUM ('PENDING', 'REVIEWING', 'CONTACTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('NEW_ORDER_ADMIN', 'ORDER_CONFIRMED_CUSTOMER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "phone" TEXT,
    "referralSource" "ReferralSource",
    "referralOther" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT NOT NULL,
    "alt" TEXT,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "imageId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "categoryId" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "availability" "Availability" NOT NULL DEFAULT 'MADE_TO_ORDER',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" INTEGER NOT NULL,
    "refWidthCm" INTEGER NOT NULL,
    "refHeightCm" INTEGER NOT NULL,
    "allowCustomSize" BOOLEAN NOT NULL DEFAULT false,
    "pricePerM2" INTEGER,
    "minPrice" INTEGER,
    "minWidthCm" INTEGER,
    "maxWidthCm" INTEGER,
    "minHeightCm" INTEGER,
    "maxHeightCm" INTEGER,
    "promoType" "PromotionType",
    "promoValue" INTEGER,
    "promoStartsAt" TIMESTAMP(3),
    "promoEndsAt" TIMESTAMP(3),
    "materials" TEXT,
    "weightKg" DECIMAL(6,2),
    "depthCm" DECIMAL(6,1),
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "characteristics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "price" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "description" TEXT,
    "swatch" TEXT,
    "imageId" TEXT,
    "priceType" "PriceType" NOT NULL DEFAULT 'FIXED',
    "price" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFrame" (
    "productId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "priceOverride" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductFrame_pkey" PRIMARY KEY ("productId","frameId")
);

-- CreateTable
CREATE TABLE "ExtraOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableForCustom" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductExtra" (
    "productId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "priceOverride" INTEGER,

    CONSTRAINT "ProductExtra_pkey" PRIMARY KEY ("productId","extraId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wilayaCode" TEXT NOT NULL,
    "wilayaName" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productImageUrl" TEXT,
    "widthCm" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "frameId" TEXT,
    "frameName" TEXT,
    "color" TEXT,
    "extras" JSONB NOT NULL DEFAULT '[]',
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "pricingBreakdown" JSONB NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "orderId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wilayaCode" TEXT,
    "wilayaName" TEXT,
    "commune" TEXT,
    "address" TEXT,
    "designMediaId" TEXT,
    "description" TEXT NOT NULL,
    "widthCm" INTEGER,
    "heightCm" INTEGER,
    "frameId" TEXT,
    "frameName" TEXT,
    "extras" JSONB NOT NULL DEFAULT '[]',
    "otherIdea" TEXT,
    "notes" TEXT,
    "status" "CustomOrderStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReviewSource" NOT NULL DEFAULT 'CUSTOMER',
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DeliveryRule" (
    "id" TEXT NOT NULL,
    "wilayaCode" TEXT,
    "commune" TEXT,
    "fee" INTEGER NOT NULL,
    "freeAbove" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Media_key_key" ON "Media"("key");

-- CreateIndex
CREATE INDEX "Media_visibility_createdAt_idx" ON "Media"("visibility", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_categoryId_idx" ON "Product"("status", "categoryId");

-- CreateIndex
CREATE INDEX "Product_status_isFeatured_idx" ON "Product"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_widthCm_heightCm_key" ON "ProductSize"("productId", "widthCm", "heightCm");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_email_idx" ON "Order"("email");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_orderId_idx" ON "EmailLog"("orderId");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrder_reference_key" ON "CustomOrder"("reference");

-- CreateIndex
CREATE INDEX "CustomOrder_status_createdAt_idx" ON "CustomOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomOrder_userId_idx" ON "CustomOrder"("userId");

-- CreateIndex
CREATE INDEX "Review_status_productId_idx" ON "Review"("status", "productId");

-- CreateIndex
CREATE INDEX "Review_status_isFeatured_idx" ON "Review"("status", "isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsSection_key_key" ON "CmsSection"("key");

-- CreateIndex
CREATE INDEX "DeliveryRule_isActive_wilayaCode_idx" ON "DeliveryRule"("isActive", "wilayaCode");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameOption" ADD CONSTRAINT "FrameOption_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFrame" ADD CONSTRAINT "ProductFrame_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFrame" ADD CONSTRAINT "ProductFrame_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "FrameOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExtra" ADD CONSTRAINT "ProductExtra_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExtra" ADD CONSTRAINT "ProductExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "ExtraOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_designMediaId_fkey" FOREIGN KEY ("designMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
