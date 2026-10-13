/**
 * Adaptador de CRM genérico: o template não assume Chatwoot, HubSpot, um CRM
 * próprio (como o do Bioete) ou nenhum — implemente esta interface pro CRM
 * real do cliente.
 */

import type { Lead } from "./tipos.js";

export interface RegistroCrm {
  lead: Lead;
  campos: Record<string, string>;
  etapa: string;
}

export interface CrmAdapter {
  upsertLead(registro: RegistroCrm): Promise<void>;
  registrarAtividade(conversaId: string, texto: string): Promise<void>;
  transferirParaHumano(conversaId: string, motivo: string): Promise<void>;
}

/** Implementação de desenvolvimento — só loga. Troque pela integração real. */
export class CrmConsole implements CrmAdapter {
  async upsertLead(registro: RegistroCrm): Promise<void> {
    console.log("[crm] upsertLead", registro);
  }
  async registrarAtividade(conversaId: string, texto: string): Promise<void> {
    console.log("[crm] atividade", conversaId, texto);
  }
  async transferirParaHumano(conversaId: string, motivo: string): Promise<void> {
    console.log("[crm] transferir", conversaId, motivo);
  }
}

/**
 * Exemplo de adaptador HTTP com retry exponencial, no espírito do
 * `tools/crm.ts` do Bioete (chamada a um CRM próprio por API key).
 */
export class CrmHttp implements CrmAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly maxTentativas = 3,
  ) {}

  private async postComRetry(path: string, body: unknown): Promise<void> {
    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= this.maxTentativas; tentativa++) {
      try {
        const resp = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`CRM respondeu ${resp.status}`);
        return;
      } catch (erro) {
        ultimoErro = erro;
        if (tentativa < this.maxTentativas) {
          await new Promise((r) => setTimeout(r, 2 ** tentativa * 500));
        }
      }
    }
    throw ultimoErro;
  }

  upsertLead(registro: RegistroCrm): Promise<void> {
    return this.postComRetry("/leads", registro);
  }
  registrarAtividade(conversaId: string, texto: string): Promise<void> {
    return this.postComRetry(`/conversas/${conversaId}/atividades`, { texto });
  }
  transferirParaHumano(conversaId: string, motivo: string): Promise<void> {
    return this.postComRetry(`/conversas/${conversaId}/transferir`, { motivo });
  }
}
