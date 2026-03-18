import type { PaymentItem } from "../../api/payments";

export type PaymentsView = "pending" | "owed" | "history";

export type PaymentGroup = {
  key: string;
  items: PaymentItem[];
  total: number;
  payee: string;
  payer: string;
  payerType: "user" | "faction";
  payerSubjectId: number | null;
};

export type PaymentsActionState = {
  working: boolean;
  message: string | null;
  error: string | null;
};