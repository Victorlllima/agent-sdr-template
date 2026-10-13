# agent-sdr-template

Template de agente de qualificação/vendas (SDR) via WhatsApp da GenixTech. Sobre
[`@genixtech/agent-core`](https://github.com/Victorlllima/agent-core-template), com os padrões
específicos de SDR extraídos da Sofia (GenixMed), do Bioete-comercial (Grupo MPF) e do
agente-sdr/agente-whatsapp (referência externa).

## O que vem pronto

- **`spiced.ts`** — rastreamento de Situação/Dor/Impacto/evento Crítico/Decisão a partir dos
  registros extraídos pelo core. Avança um passo por vez, não pula etapa.
- **`followup.ts`** — follow-up multi-trilha (a cadência de toques depende de onde a conversa
  parou, não só de quanto tempo passou) com o relógio reiniciando só em troca de verdade
  (lead respondeu **e** o agente respondeu de volta).
- **`crm.ts`** — interface `CrmAdapter` plugável (não assume Chatwoot/HubSpot/CRM próprio), com
  um exemplo de implementação HTTP com retry exponencial.
- **`agente.ts`** — esqueleto do loop principal, já ligando anti-loop, debounce, controle de IA,
  cache de prompt e extração de registro do core.

## O que é TODO de propósito

Persona, roteiro de vendas, ofertas/preços, provedor de WhatsApp (Evolution, Uzapi, Cloud API
oficial) e o CRM real — isso é específico de cada cliente. Procure por `TODO` em `agente.ts`.

## Como começar um projeto novo a partir daqui

1. No GitHub, "Use this template" neste repo.
2. `npm install`
3. Preencha `PROMPT_FIXO` em `src/agente.ts` com o roteiro real.
4. Implemente o `CrmAdapter` do cliente (`src/crm.ts`) e o adaptador de canal WhatsApp.
5. Ajuste `CAMPOS_POR_ETAPA` (`src/spiced.ts`) e as trilhas de follow-up (`src/followup.ts`)
   pro funil real.

## Decisão consciente a revisar por projeto

O agente-sdr original (referência externa) usa uma persona que nunca se identifica como IA. Isso
é uma escolha de cada cliente, não um padrão a copiar sem refletir — revise o enquadramento
ético/regulatório antes de replicar.

## Desenvolvimento

```bash
npm install
npm test
npm run build
```
