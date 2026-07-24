import { parse } from "csv-parse/sync";
import { OrderStatus } from "../generated/prisma/client";
import type { OrderModel } from "../generated/prisma/models";

const STATUS_MAP: Record<string, OrderStatus> = {
  delivered: OrderStatus.DELIVERED,
  delayed: OrderStatus.DELAYED,
  exception: OrderStatus.EXCEPTION,
  in_transit: OrderStatus.IN_TRANSIT,
  canceled: OrderStatus.CANCELED,
};

/** Re-exported as the canonical order type — same shape Prisma returns, so
 * DB-fetched and CSV-parsed orders are interchangeable everywhere else. */
export type OrderRecord = OrderModel;

type CsvRow = Record<string, string>;

export function parseOrdersCsv(csvText: string): OrderRecord[] {
  const rows: CsvRow[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  });
  return rows.map(rowToOrder);
}

function rowToOrder(row: CsvRow): OrderRecord {
  const status = STATUS_MAP[row.status];
  if (!status) {
    throw new Error(`Unknown status "${row.status}" for order ${row.order_id}`);
  }

  return {
    id: row.order_id,
    clientId: row.client_id,
    orderDate: new Date(row.order_date),
    deliveryDate: row.delivery_date ? new Date(row.delivery_date) : null,
    carrier: row.carrier,
    originCity: row.origin_city,
    destinationCity: row.destination_city,
    status,
    sku: row.sku,
    productCategory: row.product_category,
    quantity: Number(row.quantity),
    unitPriceUsd: Number(row.unit_price_usd),
    orderValueUsd: Number(row.order_value_usd),
    isPromo: row.is_promo === "1",
    promoDiscountPct: Number(row.promo_discount_pct),
    region: row.region,
    warehouse: row.warehouse,
  };
}
