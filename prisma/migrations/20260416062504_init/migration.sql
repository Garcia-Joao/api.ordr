/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[companyId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,slug]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderItemId,groupId]` on the table `OrderItemVariationSelection` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[selectionId,optionId]` on the table `OrderItemVariationSelectionOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,name]` on the table `ProductVariationGroup` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[groupId,name]` on the table `ProductVariationOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Order` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `ProductVariationGroup` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `selectionType` on the `ProductVariationGroup` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `ProductVariationOption` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'cashier', 'waiter');

-- CreateEnum
CREATE TYPE "SelectionType" AS ENUM ('single', 'multiple');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariationGroup" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "selectionType",
ADD COLUMN     "selectionType" "SelectionType" NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariationOption" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'admin';

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_name_key" ON "Category"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_slug_key" ON "Category"("companyId", "slug");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemVariationSelection_orderItemId_groupId_key" ON "OrderItemVariationSelection"("orderItemId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemVariationSelectionOption_selectionId_optionId_key" ON "OrderItemVariationSelectionOption"("selectionId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_name_key" ON "Product"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariationGroup_productId_name_key" ON "ProductVariationGroup"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariationOption_groupId_name_key" ON "ProductVariationOption"("groupId", "name");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_username_key" ON "User"("companyId", "username");
