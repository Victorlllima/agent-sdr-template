import { describe, expect, it } from "vitest";
import { avancarEtapa, camposFaltantes, etapaInicial } from "./spiced.js";

describe("spiced", () => {
  it("começa na etapa situacao sem campos", () => {
    const estado = etapaInicial();
    expect(estado.etapa).toBe("situacao");
    expect(camposFaltantes(estado)).toEqual([
      "situacao",
      "dor",
      "impacto",
      "evento_critico",
      "decisao",
    ]);
  });

  it("não avança sem o campo da etapa atual preenchido", () => {
    const estado = etapaInicial();
    expect(avancarEtapa(estado).etapa).toBe("situacao");
  });

  it("avança um passo de cada vez conforme os campos são preenchidos", () => {
    let estado = { etapa: "situacao" as const, campos: { situacao: "tem 3 lojas" } };
    estado = avancarEtapa(estado);
    expect(estado.etapa).toBe("dor");

    estado = avancarEtapa({ ...estado, campos: { ...estado.campos, dor: "perde venda" } });
    expect(estado.etapa).toBe("impacto");
  });

  it("não ultrapassa a última etapa", () => {
    const estado = { etapa: "fechamento" as const, campos: {} };
    expect(avancarEtapa(estado).etapa).toBe("fechamento");
  });
});
