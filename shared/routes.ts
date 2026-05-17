
import { z } from 'zod';
import { insertDailyReportSchema, insertExpenseItemSchema, selectDailyReportSchema, selectExpenseItemSchema, selectVegetableItemSchema, inventoryWithItemsSchema, selectClientNameSchema, selectSavedMenuSchema, purchaseRequestWithItemsSchema, selectSavedItemNameSchema, selectVendorSchema, purchaseInvoiceWithItemsSchema, selectItemMasterSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// Report with items schema for responses
const expenseItemSchema = selectExpenseItemSchema;
const dailyReportSchema = selectDailyReportSchema;

const reportWithItemsSchema = dailyReportSchema.extend({
  items: z.array(expenseItemSchema)
});

// Input schema for creating a report with items
const createReportInput = insertDailyReportSchema.extend({
  items: z.array(insertExpenseItemSchema.omit({ reportId: true }))
});

// Input schema for updating a report
const updateReportInput = insertDailyReportSchema.partial().extend({
  items: z.array(insertExpenseItemSchema.omit({ reportId: true }).extend({ id: z.number().optional() })).optional()
});

export const api = {
  reports: {
    list: {
      method: 'GET' as const,
      path: '/api/reports' as const,
      responses: {
        200: z.array(reportWithItemsSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/reports/:id' as const,
      responses: {
        200: reportWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reports' as const,
      input: createReportInput,
      responses: {
        201: reportWithItemsSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/reports/:id' as const,
      input: updateReportInput,
      responses: {
        200: reportWithItemsSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/reports/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  vegetables: {
    list: {
      method: 'GET' as const,
      path: '/api/vegetables' as const,
      responses: {
        200: z.array(selectVegetableItemSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vegetables' as const,
      input: z.object({ name: z.string().min(1) }),
      responses: {
        201: selectVegetableItemSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/vegetables/:id' as const,
      input: z.object({ name: z.string().min(1) }),
      responses: {
        200: selectVegetableItemSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/vegetables/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    lastPrices: {
      method: 'GET' as const,
      path: '/api/vegetables/last-prices' as const,
      responses: {
        200: z.array(z.object({
          description: z.string(),
          rate: z.number(),
        })),
      },
    },
  },
  inventory: {
    list: {
      method: 'GET' as const,
      path: '/api/inventory' as const,
      responses: {
        200: z.array(inventoryWithItemsSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/inventory/:id' as const,
      responses: {
        200: inventoryWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/inventory' as const,
      input: z.object({
        date: z.string(),
        kitchenStock: z.array(z.object({
          name: z.string(),
          unit: z.string(),
          open: z.coerce.number().default(0),
          used: z.coerce.number().default(0),
          balance: z.coerce.number().default(0),
          remarks: z.string().default(""),
        })),
        biscuits: z.array(z.object({
          name: z.string(),
          expDate: z.string().default(""),
          brand: z.string().default(""),
          given: z.coerce.number().default(0),
          used: z.coerce.number().default(0),
          balance: z.coerce.number().default(0),
        })),
      }),
      responses: {
        201: inventoryWithItemsSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/inventory/:id' as const,
      input: z.object({
        date: z.string(),
        kitchenStock: z.array(z.object({
          name: z.string(),
          unit: z.string(),
          open: z.coerce.number().default(0),
          used: z.coerce.number().default(0),
          balance: z.coerce.number().default(0),
          remarks: z.string().default(""),
        })),
        biscuits: z.array(z.object({
          name: z.string(),
          expDate: z.string().default(""),
          brand: z.string().default(""),
          given: z.coerce.number().default(0),
          used: z.coerce.number().default(0),
          balance: z.coerce.number().default(0),
        })),
      }),
      responses: {
        200: inventoryWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/inventory/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  cashSeals: {
    list: {
      method: 'GET' as const,
      path: '/api/cash-seals' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/cash-seals/:id' as const,
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/cash-seals' as const,
      input: z.object({
        date: z.string(),
        incomeMorningQty: z.coerce.number().default(0),
        incomeLunchQty: z.coerce.number().default(0),
        incomeEveningQty: z.coerce.number().default(0),
        incomeNightQty: z.coerce.number().default(0),
        incomeNonVegRate: z.coerce.number().default(0),
        incomeNonVegQty: z.coerce.number().default(0),
        incomeVegRate: z.coerce.number().default(0),
        incomeVegQty: z.coerce.number().default(0),
        incomeMorningCashRate: z.coerce.number().default(0),
        incomeMorningCashQty: z.coerce.number().default(0),
        incomeEveningCashRate: z.coerce.number().default(0),
        incomeEveningCashQty: z.coerce.number().default(0),
        incomeOnlineBreakfastQty: z.coerce.number().default(0),
        incomeOnlineLunchQty: z.coerce.number().default(0),
        incomeOnlineEveningSnacksQty: z.coerce.number().default(0),
        incomeOnlineNightQty: z.coerce.number().default(0),
        expenseBananaQty: z.coerce.number().default(0),
        expenseDahiBharQty: z.coerce.number().default(0),
        expenseDahiBharRate: z.coerce.number().default(0),
        expenseOtherAmount: z.coerce.number().default(0),
        totalGivenToAkbarAli: z.coerce.number().default(0),
        incomePsBreakfastCashQty: z.coerce.number().default(0),
        incomePsLunchCashQty: z.coerce.number().default(0),
        incomePsEveningCashQty: z.coerce.number().default(0),
        incomePsNightCashQty: z.coerce.number().default(0),
        incomePsRechargeRate: z.coerce.number().default(0),
        incomePsRechargeCashQty: z.coerce.number().default(0),
        incomePsBreakfastOnlineQty: z.coerce.number().default(0),
        incomePsLunchOnlineQty: z.coerce.number().default(0),
        incomePsEveningOnlineQty: z.coerce.number().default(0),
        incomePsNightOnlineQty: z.coerce.number().default(0),
        incomePsRechargeOnlineQty: z.coerce.number().default(0),
        incomeTpBreakfastCashQty: z.coerce.number().default(0),
        incomeTpLunchVegCashQty: z.coerce.number().default(0),
        incomeTpLunchNvRate: z.coerce.number().default(0),
        incomeTpLunchNvCashQty: z.coerce.number().default(0),
        incomeTpLunchEggCashQty: z.coerce.number().default(0),
        incomeTpLunchFishCashQty: z.coerce.number().default(0),
        incomeTpLunchChickenCashQty: z.coerce.number().default(0),
        incomeTpEveningCashQty: z.coerce.number().default(0),
        incomeTpNightCashQty: z.coerce.number().default(0),
        incomeTpBreakfastOnlineQty: z.coerce.number().default(0),
        incomeTpLunchVegOnlineQty: z.coerce.number().default(0),
        incomeTpLunchNvOnlineQty: z.coerce.number().default(0),
        incomeTpLunchEggOnlineQty: z.coerce.number().default(0),
        incomeTpLunchFishOnlineQty: z.coerce.number().default(0),
        incomeTpLunchChickenOnlineQty: z.coerce.number().default(0),
        incomeTpEveningOnlineQty: z.coerce.number().default(0),
        incomeTpNightOnlineQty: z.coerce.number().default(0),
      }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
  },
  menus: {
    list: {
      method: 'GET' as const,
      path: '/api/menus' as const,
      responses: {
        200: z.array(selectSavedMenuSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/menus/:id' as const,
      responses: {
        200: selectSavedMenuSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/menus' as const,
      input: z.object({
        clientName: z.string().min(1),
        startDate: z.string(),
        endDate: z.string(),
        menuData: z.string(),
      }),
      responses: {
        201: selectSavedMenuSchema,
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/menus/:id' as const,
      responses: {
        204: z.void(),
      },
    },
  },
  purchaseRequests: {
    list: {
      method: 'GET' as const,
      path: '/api/purchase-requests' as const,
      responses: {
        200: z.array(purchaseRequestWithItemsSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/purchase-requests/:id' as const,
      responses: {
        200: purchaseRequestWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/purchase-requests' as const,
      input: z.object({
        clientName: z.string().min(1),
        date: z.string(),
        items: z.array(z.object({
          itemName: z.string().min(1),
          uom: z.string().min(1),
          requestQty: z.coerce.number().default(0),
        })),
      }),
      responses: {
        201: purchaseRequestWithItemsSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/purchase-requests/:id' as const,
      input: z.object({
        clientName: z.string().min(1).optional(),
        date: z.string().optional(),
        status: z.string().optional(),
        items: z.array(z.object({
          id: z.number().optional(),
          itemName: z.string().min(1),
          uom: z.string().min(1),
          requestQty: z.coerce.number().default(0),
          approveQty: z.coerce.number().nullable().optional(),
          approved: z.boolean().default(false),
        })).optional(),
      }),
      responses: {
        200: purchaseRequestWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/purchase-requests/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  savedItems: {
    list: {
      method: 'GET' as const,
      path: '/api/saved-items' as const,
      responses: {
        200: z.array(selectSavedItemNameSchema),
      },
    },
  },
  clients: {
    list: {
      method: 'GET' as const,
      path: '/api/clients' as const,
      responses: {
        200: z.array(selectClientNameSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/clients' as const,
      input: z.object({ name: z.string().min(1), address: z.string().optional(), gstNo: z.string().optional(), stateName: z.string().optional(), stateCode: z.string().optional(), agreementValidTill: z.string().nullable().optional(), attendanceLat: z.number().nullable().optional(), attendanceLng: z.number().nullable().optional(), attendanceRadius: z.number().optional() }),
      responses: {
        201: selectClientNameSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/clients/:id' as const,
      input: z.object({ name: z.string().min(1), address: z.string().optional(), gstNo: z.string().optional(), stateName: z.string().optional(), stateCode: z.string().optional(), agreementValidTill: z.string().nullable().optional(), attendanceLat: z.number().nullable().optional(), attendanceLng: z.number().nullable().optional(), attendanceRadius: z.number().optional() }),
      responses: {
        200: selectClientNameSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/clients/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  admin: {
    verifyPin: {
      method: 'POST' as const,
      path: '/api/admin/verify-pin' as const,
      input: z.object({ pin: z.string() }),
      responses: {
        200: z.object({ valid: z.boolean() }),
      },
    },
    changePin: {
      method: 'POST' as const,
      path: '/api/admin/change-pin' as const,
      input: z.object({ currentPin: z.string(), newPin: z.string().min(4) }),
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
  },
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string().min(1), password: z.string().min(1) }),
      responses: {
        200: z.object({ id: z.number(), username: z.string(), displayName: z.string(), role: z.string(), clientName: z.string().nullable() }),
        401: errorSchemas.validation,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.object({ id: z.number(), username: z.string(), displayName: z.string(), role: z.string(), clientName: z.string().nullable() }),
        401: errorSchemas.validation,
      },
    },
  },
  vendors: {
    list: {
      method: 'GET' as const,
      path: '/api/vendors' as const,
      responses: {
        200: z.array(selectVendorSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vendors' as const,
      input: z.object({ name: z.string().min(1), phone: z.string().default(""), address: z.string().default(""), gstNo: z.string().default(""), linkedClients: z.array(z.string()).optional() }),
      responses: {
        201: selectVendorSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/vendors/:id' as const,
      input: z.object({ name: z.string().min(1), phone: z.string().optional(), address: z.string().optional(), gstNo: z.string().optional(), linkedClients: z.array(z.string()).optional() }),
      responses: {
        200: selectVendorSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/vendors/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  purchaseInvoices: {
    list: {
      method: 'GET' as const,
      path: '/api/purchase-invoices' as const,
      responses: {
        200: z.array(purchaseInvoiceWithItemsSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/purchase-invoices/:id' as const,
      responses: {
        200: purchaseInvoiceWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/purchase-invoices' as const,
      input: z.object({
        purchaseRequestId: z.number().nullable().optional(),
        allPrIds: z.array(z.number()).optional(),
        djInvoiceNo: z.string().optional(),
        clientName: z.string().min(1),
        vendorName: z.string().min(1),
        vendorInvoiceNo: z.string().default(""),
        date: z.string(),
        paymentGiven: z.boolean().default(false),
        items: z.array(z.object({
          itemName: z.string().min(1),
          uom: z.string().min(1),
          qty: z.coerce.number().default(0),
          unitPrice: z.coerce.number().default(0),
          totalPrice: z.coerce.number().default(0),
          gstRate: z.coerce.number().default(0),
          gstAmount: z.coerce.number().default(0),
          netAmount: z.coerce.number().default(0),
        })),
      }),
      responses: {
        201: purchaseInvoiceWithItemsSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/purchase-invoices/:id' as const,
      input: z.object({
        purchaseRequestId: z.number().nullable().optional(),
        djInvoiceNo: z.string().optional(),
        clientName: z.string().min(1).optional(),
        vendorName: z.string().min(1).optional(),
        vendorInvoiceNo: z.string().optional(),
        date: z.string().optional(),
        paymentGiven: z.boolean().optional(),
        items: z.array(z.object({
          id: z.number().optional(),
          itemName: z.string().min(1),
          uom: z.string().min(1),
          qty: z.coerce.number().default(0),
          unitPrice: z.coerce.number().default(0),
          totalPrice: z.coerce.number().default(0),
          gstRate: z.coerce.number().default(0),
          gstAmount: z.coerce.number().default(0),
          netAmount: z.coerce.number().default(0),
        })).optional(),
      }),
      responses: {
        200: purchaseInvoiceWithItemsSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/purchase-invoices/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    lastPrices: {
      method: 'GET' as const,
      path: '/api/purchase-invoices/last-prices' as const,
      responses: {
        200: z.array(z.object({
          itemName: z.string(),
          unitPrice: z.number(),
          gstRate: z.number(),
        })),
      },
    },
    nextDjNo: {
      method: 'GET' as const,
      path: '/api/purchase-invoices/next-dj-no' as const,
      responses: {
        200: z.object({ djInvoiceNo: z.string() }),
      },
    },
    getPayments: {
      method: 'GET' as const,
      path: '/api/purchase-invoices/:id/payments' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          invoiceId: z.number(),
          paymentDate: z.string(),
          amount: z.string(),
          notes: z.string().nullable(),
          createdAt: z.string().or(z.date()).optional(),
        })),
      },
    },
    addPayment: {
      method: 'POST' as const,
      path: '/api/purchase-invoices/:id/payments' as const,
      input: z.object({
        paymentDate: z.string().min(1),
        amount: z.coerce.number().positive(),
        notes: z.string().optional(),
      }),
      responses: {
        201: z.object({
          id: z.number(),
          invoiceId: z.number(),
          paymentDate: z.string(),
          amount: z.string(),
          notes: z.string().nullable(),
        }),
      },
    },
    updatePayment: {
      method: 'PATCH' as const,
      path: '/api/purchase-invoice-payments/:id' as const,
      input: z.object({
        paymentDate: z.string().min(1),
        amount: z.coerce.number().positive(),
        notes: z.string().optional(),
      }),
      responses: {
        200: z.object({
          id: z.number(),
          invoiceId: z.number(),
          paymentDate: z.string(),
          amount: z.string(),
          notes: z.string().nullable(),
        }),
      },
    },
    deletePayment: {
      method: 'DELETE' as const,
      path: '/api/purchase-invoice-payments/:id' as const,
      responses: {
        204: z.void(),
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users' as const,
      input: z.object({
        username: z.string().min(1),
        password: z.string().min(4),
        displayName: z.string().min(1),
        role: z.string().default("user"),
        clientName: z.string().nullable().default(null),
        permissions: z.array(z.string()).default(['expense', 'cashseal', 'inventory', 'menu', 'salesinvoice']),
        employeeId: z.number().nullable().optional(),
      }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/users/:id' as const,
      input: z.object({
        displayName: z.string().min(1).optional(),
        password: z.string().min(4).optional(),
        role: z.string().optional(),
        clientName: z.string().nullable().optional(),
        permissions: z.array(z.string()).optional(),
        employeeId: z.number().nullable().optional(),
      }),
      responses: {
        200: z.any(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id' as const,
      responses: {
        204: z.void(),
      },
    },
  },
  itemMaster: {
    list: {
      method: 'GET' as const,
      path: '/api/item-master' as const,
      responses: {
        200: z.array(selectItemMasterSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/item-master' as const,
      input: z.object({
        itemName: z.string().min(1),
        uom: z.string().default("Kg"),
        rate: z.string().default("0"),
        hsnCode: z.string().default(""),
        gstPercent: z.string().default("0"),
        itemType: z.string().default("purchase"),
        itemCategory: z.string().default("General"),
      }),
      responses: {
        201: selectItemMasterSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/item-master/:id' as const,
      input: z.object({
        itemName: z.string().min(1).optional(),
        uom: z.string().optional(),
        rate: z.string().optional(),
        hsnCode: z.string().optional(),
        gstPercent: z.string().optional(),
        itemType: z.string().optional(),
        itemCategory: z.string().optional(),
      }),
      responses: {
        200: selectItemMasterSchema,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/item-master/:id' as const,
      responses: {
        204: z.void(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
