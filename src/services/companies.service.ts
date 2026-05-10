import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type CreateTestCompanyInput = {
  userId: string
  sourceCompanyId: string
  copyData: boolean
}

export async function createTestCompanyFromCompany({
  userId,
  sourceCompanyId,
  copyData,
}: CreateTestCompanyInput) {
  const sourceCompany = await prisma.company.findUnique({
    where: { id: sourceCompanyId },
    include: {
      categories: true,
      products: {
        include: {
          variationGroups: {
            include: {
              options: true,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      memberships: true,
      testCompanies: true,
    },
  })

  if (!sourceCompany) {
    throw new Error('SOURCE_COMPANY_NOT_FOUND')
  }

  if (sourceCompany.isTest) {
    throw new Error('SOURCE_COMPANY_IS_ALREADY_TEST')
  }

  const existingTestCompany = await prisma.company.findFirst({
    where: {
      testSourceCompanyId: sourceCompany.id,
      isTest: true,
    },
  })

  if (existingTestCompany) {
    return {
      ok: true,
      alreadyExists: true,
      company: existingTestCompany,
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const newCompany = await tx.company.create({
      data: {
        name: `${sourceCompany.name} - Teste`,
        isTest: true,
        testSourceCompanyId: sourceCompany.id,
        platformAccessStatus: sourceCompany.platformAccessStatus,
      },
    })

    await tx.userCompany.create({
      data: {
        userId,
        companyId: newCompany.id,
        role: 'admin',
        systemRole: 'ADMIN',
      },
    })

    if (!copyData) {
      return newCompany
    }

    const categoryIdMap = new Map<string, string>()

    for (const category of sourceCompany.categories) {
      const createdCategory = await tx.category.create({
        data: {
          companyId: newCompany.id,
          name: category.name,
          slug: category.slug,
          emoji: category.emoji,
        },
      })

      categoryIdMap.set(category.id, createdCategory.id)
    }

    const defaultEnvironment = await tx.salesEnvironment.create({
      data: {
        companyId: newCompany.id,
        name: 'Default',
        color: '#dd7c12',
        isDefault: true,
        active: true,
      },
    })

    for (const product of sourceCompany.products) {
      const mappedCategoryId = categoryIdMap.get(product.categoryId)

      if (!mappedCategoryId) {
        throw new Error(`CATEGORY_NOT_MAPPED_FOR_PRODUCT_${product.id}`)
      }

      const createdProduct = await tx.product.create({
        data: {
          companyId: newCompany.id,
          categoryId: mappedCategoryId,
          name: product.name,
          description: product.description,
          emoji: product.emoji,
          price: new Prisma.Decimal(product.price),
          active: product.active,
          isStockOnly: product.isStockOnly,
          trackStock: product.trackStock,
          stockQuantity: product.stockQuantity,
          minStock: product.minStock,
          unitContentQuantity: product.unitContentQuantity
            ? new Prisma.Decimal(product.unitContentQuantity)
            : null,
          unitContentUnit: product.unitContentUnit,
          costMode: product.costMode,
          simpleCost: product.simpleCost
            ? new Prisma.Decimal(product.simpleCost)
            : null,
          stockUnit: product.stockUnit,
          referenceQuantity: product.referenceQuantity
            ? new Prisma.Decimal(product.referenceQuantity)
            : null,
          referenceCost: product.referenceCost
            ? new Prisma.Decimal(product.referenceCost)
            : null,
          madeOnDemand: product.madeOnDemand,
          unlimitedStock: product.unlimitedStock,
          recipeOutputQuantity: product.recipeOutputQuantity
            ? new Prisma.Decimal(product.recipeOutputQuantity)
            : null,
          recipeOutputUnit: product.recipeOutputUnit,
        },
      })

      await tx.productEnvironmentPrice.create({
        data: {
          productId: createdProduct.id,
          salesEnvironmentId: defaultEnvironment.id,
          price: new Prisma.Decimal(product.price),
        },
      })

      for (const group of product.variationGroups) {
        const createdGroup = await tx.productVariationGroup.create({
          data: {
            productId: createdProduct.id,
            name: group.name,
            required: group.required,
            sortOrder: group.sortOrder,
            selectionType: group.selectionType,
          },
        })

        for (const option of group.options) {
          await tx.productVariationOption.create({
            data: {
              groupId: createdGroup.id,
              name: option.name,
              priceModifier: new Prisma.Decimal(option.priceModifier),
              sortOrder: option.sortOrder,
              active: option.active,
              costMode: option.costMode,
              simpleCost: option.simpleCost
                ? new Prisma.Decimal(option.simpleCost)
                : null,
              stockUnit: option.stockUnit,
              referenceQuantity: option.referenceQuantity
                ? new Prisma.Decimal(option.referenceQuantity)
                : null,
              referenceCost: option.referenceCost
                ? new Prisma.Decimal(option.referenceCost)
                : null,
            },
          })
        }
      }
    }

    return newCompany
  })

  return {
    ok: true,
    alreadyExists: false,
    company: result,
  }
}