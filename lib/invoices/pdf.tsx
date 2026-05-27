/**
 * lib/invoices/pdf.tsx
 *
 * Template PDF de factura — réplica del diseño original de Invoicing_app.
 * Usa @react-pdf/renderer (puro JS, sin Chrome) → compatible con Vercel.
 *
 * Solo se importa desde server actions. No importar en componentes "use client".
 */
import "server-only";

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

import type { InvoiceItem, InvoiceSettings } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(symbol: string, amount: number): string {
  return `${symbol}${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLogoSrc(): string | null {
  try {
    const p = path.join(
      process.cwd(),
      "public",
      "branding",
      "Logo_Y_Texto_Transparente.png"
    );
    if (!fs.existsSync(p)) return null;
    const b64 = fs.readFileSync(p).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

// ── Colores ───────────────────────────────────────────────────────────────────

const C = {
  dark: "#2a2a2a",
  body: "#333333",
  muted: "#555555",
  gray: "#777777",
  light: "#aaaaaa",
  border: "#e8e8e8",
  bg: "#efefef",
  white: "#ffffff",
  pageNum: "#bbbbbb",
};

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 13,
    color: C.body,
    backgroundColor: C.white,
    paddingTop: 48,
    paddingBottom: 56,
    paddingLeft: 52,
    paddingRight: 52,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    height: 70,
    objectFit: "contain",
  },
  invTitleBlock: {
    alignItems: "flex-end",
  },
  invH1: {
    fontSize: 52,
    color: C.dark,
    lineHeight: 1,
  },
  invId: {
    fontSize: 15,
    color: C.gray,
    marginTop: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  dateLabel: {
    color: C.light,
    marginRight: 48,
  },

  // Info row
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  infoLeft: {
    flex: 1,
    marginRight: 40,
  },
  fromName: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  fromDetails: {
    color: C.muted,
    lineHeight: 1.75,
  },
  billLabel: {
    color: C.light,
    fontSize: 12,
    marginTop: 22,
    marginBottom: 5,
  },
  clientName: {
    fontFamily: "Helvetica-Bold",
  },
  clientAddress: {
    color: C.muted,
    lineHeight: 1.75,
  },

  // Balance Due box
  balanceBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.bg,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 3,
    minWidth: 280,
  },
  balanceLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginRight: 20,
  },
  balanceAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
  },

  // Tabla
  table: {
    marginTop: 36,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.dark,
  },
  thItem: {
    flex: 52,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 16,
    paddingRight: 16,
    fontSize: 12,
    color: C.white,
  },
  thRight: {
    flex: 16,
    paddingTop: 11,
    paddingBottom: 11,
    paddingLeft: 16,
    paddingRight: 16,
    fontSize: 12,
    color: C.white,
    textAlign: "right",
  },
  tableBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: "solid",
  },
  tdItem: {
    flex: 52,
    paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 16,
    paddingRight: 16,
  },
  tdRight: {
    flex: 16,
    paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 16,
    paddingRight: 16,
    textAlign: "right",
  },
  itemName: {
    fontFamily: "Helvetica-Bold",
  },
  itemDesc: {
    color: C.light,
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.5,
  },

  // Totales
  totals: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginTop: 28,
    marginBottom: 48,
  },
  trow: {
    flexDirection: "row",
    marginBottom: 9,
  },
  tlabel: {
    color: C.light,
    minWidth: 160,
    textAlign: "right",
    marginRight: 52,
  },
  tamount: {
    minWidth: 100,
    textAlign: "right",
  },

  // Notas
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: "solid",
    paddingTop: 18,
  },
  notesLabel: {
    color: C.light,
    fontSize: 12,
    marginBottom: 7,
  },
  notesBody: {
    color: C.muted,
    lineHeight: 1.7,
  },

  // Número de página
  pageNum: {
    position: "absolute",
    bottom: 24,
    left: 52,
    color: C.pageNum,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});

// ── Props ─────────────────────────────────────────────────────────────────────

export type InvoicePDFProps = {
  id: string;
  date: string;
  clientName: string;
  clientAddress: string;
  clientCountry: string;
  items: InvoiceItem[];
  currencySymbol: string;
  subtotal: number;
  discountEnabled: boolean;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  upfrontEnabled: boolean;
  upfrontPercentage: number;
  upfrontAmount: number;
  total: number;
  notes: string | null;
  settings: InvoiceSettings;
};

// ── Componente ────────────────────────────────────────────────────────────────

export function InvoicePDF(props: InvoicePDFProps) {
  const {
    id,
    date,
    clientName,
    clientAddress,
    clientCountry,
    items,
    currencySymbol,
    subtotal,
    discountEnabled,
    discountType,
    discountValue,
    discountAmount,
    upfrontEnabled,
    upfrontPercentage,
    upfrontAmount,
    total,
    notes,
    settings,
  } = props;

  const logoSrc = getLogoSrc();
  const hasBreakdown =
    (discountEnabled && discountAmount > 0) ||
    (upfrontEnabled && upfrontAmount > 0);

  const senderLines = [
    settings.sender_address,
    settings.sender_city,
    settings.sender_state,
    settings.sender_country,
  ]
    .filter(Boolean)
    .join("\n");

  const clientLines = [
    clientAddress,
    clientCountry,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          {/* Logo */}
          <View>
            {logoSrc ? (
              <Image src={logoSrc} style={S.logo} />
            ) : (
              <Text style={{ color: "#e8821e", fontSize: 11 }}>
                {"Tangerine\nStudios"}
              </Text>
            )}
          </View>

          {/* INVOICE + ID + Date */}
          <View style={S.invTitleBlock}>
            <Text style={S.invH1}>INVOICE</Text>
            <Text style={S.invId}>{id}</Text>
            <View style={S.dateRow}>
              <Text style={S.dateLabel}>Date:</Text>
              <Text>{fmtDate(date)}</Text>
            </View>
          </View>
        </View>

        {/* ── Info row: sender + balance ── */}
        <View style={S.infoRow}>
          <View style={S.infoLeft}>
            <Text style={S.fromName}>{settings.sender_name}</Text>
            {senderLines ? (
              <Text style={S.fromDetails}>{senderLines}</Text>
            ) : null}
            {settings.sender_email ? (
              <Text style={[S.fromDetails, { marginTop: 0 }]}>
                {settings.sender_email}
              </Text>
            ) : null}

            <Text style={S.billLabel}>Bill To:</Text>
            <Text style={S.clientName}>{clientName}</Text>
            {clientLines ? (
              <Text style={S.clientAddress}>{clientLines}</Text>
            ) : null}
          </View>

          <View>
            <View style={S.balanceBox}>
              <Text style={S.balanceLabel}>Balance Due:</Text>
              <Text style={S.balanceAmount}>{fmt(currencySymbol, total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Tabla de ítems ── */}
        <View style={S.table}>
          {/* Encabezado */}
          <View style={S.tableHeaderRow}>
            <Text style={S.thItem}>Item</Text>
            <Text style={S.thRight}>Quantity</Text>
            <Text style={S.thRight}>Rate</Text>
            <Text style={S.thRight}>Amount</Text>
          </View>

          {/* Filas */}
          {items.map((item, i) => (
            <View key={i} style={S.tableBodyRow}>
              <View style={S.tdItem}>
                <Text style={S.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={S.itemDesc}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={S.tdRight}>{item.quantity}</Text>
              <Text style={S.tdRight}>{fmt(currencySymbol, item.rate)}</Text>
              <Text style={S.tdRight}>
                {fmt(currencySymbol, item.quantity * item.rate)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Totales ── */}
        <View style={S.totals}>
          {hasBreakdown ? (
            <>
              <View style={S.trow}>
                <Text style={S.tlabel}>Subtotal:</Text>
                <Text style={S.tamount}>{fmt(currencySymbol, subtotal)}</Text>
              </View>
              {discountEnabled && discountAmount > 0 ? (
                <View style={S.trow}>
                  <Text style={S.tlabel}>
                    {`Discount${discountType === "percentage" ? ` (${discountValue}%)` : ""}:`}
                  </Text>
                  <Text style={S.tamount}>
                    -{fmt(currencySymbol, discountAmount)}
                  </Text>
                </View>
              ) : null}
              {upfrontEnabled && upfrontAmount > 0 ? (
                <View style={S.trow}>
                  <Text style={S.tlabel}>
                    {`Upfront payment (${upfrontPercentage}%):`}
                  </Text>
                  <Text style={S.tamount}>
                    -{fmt(currencySymbol, upfrontAmount)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
          <View style={S.trow}>
            <Text style={S.tlabel}>Total:</Text>
            <Text style={S.tamount}>{fmt(currencySymbol, total)}</Text>
          </View>
        </View>

        {/* ── Notas ── */}
        {notes ? (
          <View style={S.notesSection}>
            <Text style={S.notesLabel}>Notes:</Text>
            <Text style={S.notesBody}>{notes}</Text>
          </View>
        ) : null}

        {/* ── Número de página ── */}
        <Text
          style={S.pageNum}
          render={({ pageNumber, totalPages }) =>
            `PAGE ${pageNumber} OF ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
