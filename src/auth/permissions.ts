export type PermissionCatalogItem = {
  key: string
  label: string
  description?: string
}

export type PermissionCatalogGroup = {
  group: string
  description?: string
  permissions: PermissionCatalogItem[]
}

export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
  {
    group: 'PDV',
    description: 'Acesso às telas de venda e comandas.',
    permissions: [
      { key: 'pdv.view', label: 'Ver PDV' },
      { key: 'interno.view', label: 'Ver PDV Interno' },
      { key: 'orders.view', label: 'Ver pedidos' },
      { key: 'orders.create', label: 'Criar pedidos' },
      { key: 'orders.pay', label: 'Receber pagamentos' },
      { key: 'orders.cancel', label: 'Cancelar pedidos' },
    ],
  },
  {
    group: 'Produtos',
    description: 'Cadastro, preço e custo de produtos.',
    permissions: [
      { key: 'products.view', label: 'Ver produtos' },
      { key: 'products.create', label: 'Criar produtos' },
      { key: 'products.update', label: 'Editar produtos' },
      { key: 'products.delete', label: 'Excluir/desativar produtos' },
      { key: 'products.cost.update', label: 'Alterar custos de produtos' },
      { key: 'categories.view', label: 'Ver categorias' },
      { key: 'categories.manage', label: 'Gerenciar categorias' },
    ],
  },
  {
    group: 'Estoque e compras',
    description: 'Receitas, movimentações, compras e produção possível.',
    permissions: [
      { key: 'stock.view', label: 'Ver estoque' },
      { key: 'stock.adjust', label: 'Ajustar estoque' },
      { key: 'stock.purchase.create', label: 'Registrar compras' },
      { key: 'stock.quickBuy', label: 'Usar compra rápida' },
      { key: 'buys.view', label: 'Ver compras' },
      { key: 'buys.manage', label: 'Gerenciar compras' },
    ],
  },
  {
    group: 'Clientes e interno',
    description: 'Clientes comuns e clientes internos.',
    permissions: [
      { key: 'customers.view', label: 'Ver clientes' },
      { key: 'customers.create', label: 'Criar clientes' },
      { key: 'customers.update', label: 'Editar clientes' },
      { key: 'customers.delete', label: 'Excluir clientes' },
      { key: 'customers.eventComanda.manage', label: 'Vincular cliente à comanda de evento' },
      { key: 'internalCustomers.view', label: 'Ver clientes internos' },
      { key: 'internalCustomers.manage', label: 'Gerenciar clientes internos' },
      { key: 'internalCustomers.pay', label: 'Receber contas internas' },
    ],
  },
  {
    group: 'Eventos e equipe',
    description: 'Eventos, pessoas e avaliações de equipe.',
    permissions: [
      { key: 'events.view', label: 'Ver eventos' },
      { key: 'events.manage', label: 'Gerenciar eventos' },
      { key: 'events.active.select', label: 'Selecionar evento ativo próprio' },
      { key: 'events.active.assign', label: 'Selecionar evento ativo de usuários' },
      { key: 'people.view', label: 'Ver pessoas/equipe' },
      { key: 'people.manage', label: 'Gerenciar pessoas/equipe' },
      { key: 'staffEvaluations.view', label: 'Ver avaliações' },
      { key: 'staffEvaluations.manage', label: 'Gerenciar avaliações' },
    ],
  },
  {
    group: 'Relatórios',
    description: 'Dados financeiros e exportações.',
    permissions: [
      { key: 'reports.view', label: 'Ver relatórios' },
      { key: 'reports.profit.view', label: 'Ver lucro e margem' },
      { key: 'reports.export', label: 'Exportar relatórios' },
    ],
  },
  {
    group: 'Sistema',
    description: 'Configuração da empresa, impressoras, cargos e auditoria.',
    permissions: [
      { key: 'settings.view', label: 'Ver configurações' },
      { key: 'settings.update', label: 'Editar configurações' },
      { key: 'printers.view', label: 'Ver impressoras' },
      { key: 'printers.update', label: 'Configurar impressoras' },
      { key: 'printers.test', label: 'Testar impressoras' },
      { key: 'salesEnvironments.view', label: 'Ver ambientes de venda' },
      { key: 'salesEnvironments.manage', label: 'Gerenciar ambientes de venda' },
      { key: 'users.view', label: 'Ver usuários' },
      { key: 'users.manage', label: 'Gerenciar usuários' },
      { key: 'roles.view', label: 'Ver cargos e acessos' },
      { key: 'roles.manage', label: 'Gerenciar cargos e acessos' },
      { key: 'audit.view', label: 'Ver auditoria' },
    ],
  },
]

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
)

export function isKnownPermission(permissionKey: string) {
  return ALL_PERMISSION_KEYS.includes(permissionKey)
}
