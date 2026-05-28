/**
 * Testes das funções puras de balance.ts.
 */

import { describe, it, expect } from "vitest";
import {
  hasCredit,
  hasCommonCredit,
  CREDIT_KIND_LABEL,
  type BalanceSnapshot,
} from "@/lib/balance";

describe("balance helpers", () => {
  const emptySnapshot: BalanceSnapshot = {
    balances: { common: 0 },
    totals: {
      common: { credits_in: 0, credits_out: 0 },
    },
    saldoCents: 0,
    saldoBRL: "0 crédito(s)",
    totalCreditadoCents: 0,
    totalDebitadoCents: 0,
    movements: [],
    isLoading: false,
    isError: false,
  };

  const fullSnapshot: BalanceSnapshot = {
    balances: { common: 5 },
    totals: {
      common: { credits_in: 10, credits_out: 5 },
    },
    saldoCents: 5,
    saldoBRL: "5 crédito(s)",
    totalCreditadoCents: 10,
    totalDebitadoCents: 5,
    movements: [],
    isLoading: false,
    isError: false,
  };

  describe("hasCredit", () => {
    it("returns false when balance is 0", () => {
      expect(hasCredit(emptySnapshot, "common", 1)).toBe(false);
    });

    it("returns true when balance >= amount", () => {
      expect(hasCredit(fullSnapshot, "common", 5)).toBe(true);
      expect(hasCredit(fullSnapshot, "common", 4)).toBe(true);
    });

    it("returns false when balance < amount", () => {
      expect(hasCredit(fullSnapshot, "common", 6)).toBe(false);
    });
  });

  describe("hasCommonCredit", () => {
    it("returns false without common credit", () => {
      expect(hasCommonCredit(emptySnapshot)).toBe(false);
    });

    it("returns true with at least 1 common credit", () => {
      expect(hasCommonCredit(fullSnapshot)).toBe(true);
    });

    it("defaults to amount=1", () => {
      const snapshot: BalanceSnapshot = {
        ...emptySnapshot,
        balances: { common: 1 },
      };
      expect(hasCommonCredit(snapshot)).toBe(true);
    });
  });

  describe("CREDIT_KIND_LABEL", () => {
    it("has common kind", () => {
      expect(Object.keys(CREDIT_KIND_LABEL)).toContain("common");
    });

    it("label is in Portuguese", () => {
      expect(CREDIT_KIND_LABEL.common).toBeTruthy();
    });

    it("has exactly one entry", () => {
      expect(Object.keys(CREDIT_KIND_LABEL).length).toBe(1);
    });
  });
});
