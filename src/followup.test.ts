import { describe, expect, it } from "vitest";
import { TRILHAS_EXEMPLO, deveRecomeçar, gerarToques, toquesVencidos } from "./followup.js";

const DIA = 24 * 60 * 60 * 1000;

describe("followup", () => {
  it("gera os toques na cadência da trilha, a partir da âncora", () => {
    const ancora = 1_000_000;
    const toques = gerarToques(TRILHAS_EXEMPLO.qualificacao_incompleta, ancora);
    expect(toques.map((t) => t.disparaEm)).toEqual([
      ancora + 1 * DIA,
      ancora + 3 * DIA,
      ancora + 7 * DIA,
      ancora + 15 * DIA,
    ]);
  });

  it("só considera vencido o que passou do prazo e não foi enviado", () => {
    const ancora = 0;
    const toques = gerarToques(TRILHAS_EXEMPLO.orcamento_pendente, ancora);
    const agora = ancora + 1.5 * DIA;
    const vencidos = toquesVencidos(toques, new Set(), agora);
    expect(vencidos.map((t) => t.indice)).toEqual([0]); // só o D+1 venceu
  });

  it("não repete toque já marcado como enviado", () => {
    const toques = gerarToques(TRILHAS_EXEMPLO.orcamento_pendente, 0);
    const vencidos = toquesVencidos(toques, new Set([0]), 10 * DIA);
    expect(vencidos.map((t) => t.indice)).not.toContain(0);
  });

  it("só recomeça o relógio com troca de verdade (lead + agente), não só o lead falando", () => {
    expect(deveRecomeçar(true, false)).toBe(false);
    expect(deveRecomeçar(false, true)).toBe(false);
    expect(deveRecomeçar(true, true)).toBe(true);
  });
});
