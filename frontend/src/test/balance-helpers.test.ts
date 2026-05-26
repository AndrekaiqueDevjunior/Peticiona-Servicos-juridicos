/**
 * Testes das funções puras de balance.ts.
 *
 * Valida:
 * - hasCredit, hasCommonCredit, hasPetitionExpressCredit, hasResourceExpressCredit
 * - CREDIT_KIND_LABEL tem as 3 keys
 * - BalanceSnapshot EMPTY tem saldos corretos
 */

import { describe, it, expect } from "vitest";
import {
  hasCredit,
  hasCommonCredit,
  hasPetitionExpressCredit,
  hasResourceExpressCredit,
  CREDIT_KIND_LABEL,
  type BalanceSnapshot,
} from "@/lib/balance";

describe("balance helpers", () => {
  const emptySnapshot: BalanceSnapshot = {
    balances: { common: 0, peticao_express: 0, recurso_express: 0 },
    totals: {
      common: { credits_in: 0, credits_out: 0 },
      peticao_express: { credits_in: 0, credits_out: 0 },
      recurso_express: { credits_in: 0, credits_out: 0 },
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
    balances: { common: 5, peticao_express: 2, recurso_express: 1 },
    totals: {
      common: { credits_in: 10, credits_out: 5 },
      peticao_express: { credits_in: 3, credits_out: 1 },
      recurso_express: { credits_in: 2, credits_out: 1 },
    },
    saldoCents: 5,
    saldoBRL: "5 crédito(s)",
    totalCreditadoCents: 15,
    totalDebitadoCents: 7,
    movements: [],
    isLoading: false,
    isError: false,
  };

  describe("hasCredit", () => {
    it("returns false when balance is 0", () => {
      expect(hasCredit(emptySnapshot, "common", 1)).toBe(false);
      expect(hasCredit(emptySnapshot, "peticao_express", 1)).toBe(false);
      expect(hasCredit(emptySnapshot, "recurso_express", 1)).toBe(false);
    });

    it("returns true when balance >= amount", () => {
      expect(hasCredit(fullSnapshot, "common", 5)).toBe(true);
      expect(hasCredit(fullSnapshot, "common", 4)).toBe(true);
      expect(hasCredit(fullSnapshot, "peticao_express", 2)).toBe(true);
      expect(hasCredit(fullSnapshot, "recurso_express", 1)).toBe(true);
    });

    it("returns false when balance < amount", () => {
      expect(hasCredit(fullSnapshot, "common", 6)).toBe(false);
      expect(hasCredit(fullSnapshot, "peticao_express", 3)).toBe(false);
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
        balances: { ...emptySnapshot.balances, common: 1 },
      };
      expect(hasCommonCredit(snapshot)).toBe(true);
    });
  });

  describe("hasPetitionExpressCredit", () => {
    it("returns false without peticao_express credit", () => {
      expect(hasPetitionExpressCredit(emptySnapshot)).toBe(false);
    });

    it("returns true with at least 1 peticao_express credit", () => {
      expect(hasPetitionExpressCredit(fullSnapshot)).toBe(true);
    });
  });

  describe("hasResourceExpressCredit", () => {
    it("returns false without recurso_express credit", () => {
      expect(hasResourceExpressCredit(emptySnapshot)).toBe(false);
    });

    it("returns true with at least 1 recurso_express credit", () => {
      expect(hasResourceExpressCredit(fullSnapshot)).toBe(true);
    });
  });

  describe("CREDIT_KIND_LABEL", () => {
    it("has all three kinds", () => {
      expect(Object.keys(CREDIT_KIND_LABEL)).toContain("common");
      expect(Object.keys(CREDIT_KIND_LABEL)).toContain("peticao_express");
      expect(Object.keys(CREDIT_KIND_LABEL)).toContain("recurso_express");
    });

    it("labels are in Portuguese", () => {
      expect(CREDIT_KIND_LABEL.common).toContain("Comuns");
      expect(CREDIT_KIND_LABEL.peticao_express).toContain("Petição");
      expect(CREDIT_KIND_LABEL.recurso_express).toContain("Recurso");
    });

    it("has exactly three entries", () => {
      expect(Object.keys(CREDIT_KIND_LABEL).length).toBe(3);
    });
  });
});
