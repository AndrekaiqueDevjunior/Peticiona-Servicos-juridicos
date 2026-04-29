import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

describe("masks", () => {
  it("formatam e validam CPF/telefone/OAB sem estado local", async () => {
    const { maskCPF, maskPhone, maskOAB, isValidCPF } = await import("@/lib/masks");

    expect(maskCPF("52998224725")).toBe("529.982.247-25");
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
    expect(maskOAB("123abc456")).toBe("123456");
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });
});

describe("profileSchemas", () => {
  it("valida payload editável do perfil do cliente", async () => {
    const { profileEditableSchema } = await import("@/lib/profileSchemas");

    expect(
      profileEditableSchema.safeParse({
        phone: "(11) 91234-5678",
        email: "cliente@test.com",
      }).success,
    ).toBe(true);
    expect(profileEditableSchema.safeParse({ phone: "123", email: "x" }).success).toBe(false);
  });

  it("valida payload de cadastro do cliente", async () => {
    const { profileSignupSchema } = await import("@/lib/profileSchemas");

    const valid = profileSignupSchema.safeParse({
      fullName: "João da Silva",
      cpf: "529.982.247-25",
      oab: "12345",
      oabUf: "SP",
      phone: "(11) 91234-5678",
      email: "joao@test.com",
    });
    expect(valid.success).toBe(true);

    const invalid = profileSignupSchema.safeParse({
      fullName: "João",
      cpf: "529.982.247-25",
      oab: "12345",
      oabUf: "XX",
      phone: "(11) 91234-5678",
      email: "joao@test.com",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("format", () => {
  it("formatBRL não depende de store local", async () => {
    const { formatBRL } = await import("@/lib/format");
    expect(formatBRL(160)).toMatch(/R\$\s*160,00/);
  });
});

describe("frontend produtivo sem mock data", () => {
  const srcRoot = join(process.cwd(), "src");
  const allowedLocalStorage = new Set(["src/lib/auth.tsx", "src/lib/api.ts"]);

  const sourceFiles = walk(srcRoot)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !relative(srcRoot, file).startsWith("test/"));

  it("não mantém stores locais ou arquivos de mock em src produtivo", () => {
    const forbiddenFiles = [
      "src/lib/adminMocks.ts",
      "src/lib/staffStatus.ts",
      "src/lib/balance.ts",
      "src/lib/pedidos.ts",
      "src/lib/clientProfile.ts",
      "src/lib/pricing.ts",
    ];

    for (const file of forbiddenFiles) {
      expect(sourceFiles.map((item) => relative(process.cwd(), item))).not.toContain(file);
    }
  });

  it("não importa módulos locais antigos no fluxo produtivo", () => {
    const forbiddenImport = /@\/lib\/(adminMocks|staffStatus|balance|pedidos|clientProfile|pricing)/;

    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, relative(process.cwd(), file)).not.toMatch(forbiddenImport);
    }
  });

  it("não usa mock/localStorage como fonte de dados de negócio", () => {
    for (const file of sourceFiles) {
      const rel = relative(process.cwd(), file);
      const content = readFileSync(file, "utf8");

      expect(content, rel).not.toMatch(/\bmock\b/i);
      expect(content, rel).not.toMatch(/useSyncExternalStore/);
      if (!allowedLocalStorage.has(rel)) {
        expect(content, rel).not.toMatch(/localStorage/);
      }
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return [path];
  });
}
