export type InvoiceItem = {
  name: string;
  description: string;
  quantity: number;
  rate: number;
};

export type CurrencySymbol = "$" | "US$" | "€" | "£" | "ARS$";

export const CURRENCY_OPTIONS: CurrencySymbol[] = [
  "$",
  "US$",
  "€",
  "£",
  "ARS$",
];

export type Invoice = {
  id: string;
  invoice_number: number;
  invoice_code: string;
  date: string; // YYYY-MM-DD
  client_id: string | null;
  client_name: string;
  client_address: string;
  client_country: string;
  currency_symbol: string;
  items: InvoiceItem[];
  subtotal: number;
  discount_enabled: boolean;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  discount_amount: number;
  upfront_enabled: boolean;
  upfront_percentage: number;
  upfront_amount: number;
  total: number;
  notes: string | null;
  pdf_storage_path: string | null;
  created_at: string;
};

export type InvoiceProject = {
  id: string;
  title: string;
  project_code: string | null;
};

export type InvoiceWithProjects = Invoice & {
  projects: InvoiceProject[];
};

/** Cliente liviano con los datos que necesita el formulario de factura */
export type ClientForInvoice = {
  id: string;
  name: string;
  billing_info: string | null;
};

export type InvoiceSettings = {
  next_number: number;
  sender_name: string;
  sender_address: string;
  sender_city: string;
  sender_state: string;
  sender_country: string;
  sender_email: string;
};

export type InvoiceInput = {
  date: string;
  currency_symbol: string;
  client_name: string;
  client_address: string;
  client_country: string;
  client_id: string | null;
  items: InvoiceItem[];
  discount: {
    enabled: boolean;
    type: "percentage" | "fixed";
    value: number;
  };
  upfront: {
    enabled: boolean;
    percentage: number;
  };
  notes: string;
  project_ids: string[];
};
