# Auditoria do frontend de referência

Base analisada: `https://github.com/AndrekaiqueDevjunior/legal-craft-desk`

## Pontos encontrados no frontend original

- `src/pages/Login.tsx`: envio apenas para `console.log`, sem backend real.
- `src/pages/Cadastro.tsx`: cadastro também executado localmente com `console.log`.
- `src/pages/ClientArea.tsx`: catálogo, carrinho, totalização, busca e upload estavam todos em memória local.
- `src/pages/Dashboard.tsx`: indicadores e filtros eram calculados sobre mocks no próprio cliente.
- `src/pages/SplitPayment.tsx`: divisão percentual, validação e cálculo monetário eram feitos no navegador.

## Ação tomada nesta migração

- A aparência e o esquema visual foram preservados como referência.
- Cálculos e validações foram movidos para o backend Flask.
- O frontend `Next.js` ficou restrito a consumo de API, navegação e exibição de respostas.
