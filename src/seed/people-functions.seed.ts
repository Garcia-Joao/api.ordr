import { prisma } from '../lib/prisma'

const defaultFunctions = [
  'Barman',
  'Garçom',
  'Caixa',
  'Cozinha',
  'Músico',
  'Técnico de som',
  'Técnico de luz',
  'Manutenção',
  'Segurança',
  'Limpeza',
  'Produção',
  'Fotógrafo',
  'DJ',
]

export async function seedPeopleFunctions() {
  for (const name of defaultFunctions) {
    await prisma.personFunction.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
}