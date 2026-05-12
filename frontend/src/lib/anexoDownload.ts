// Helper de download de anexos.
//
// MOCK: como os anexos hoje são somente metadados (não há blob salvo),
// geramos um arquivo placeholder com o NOME e EXTENSÃO ORIGINAIS para
// que o navegador dispare o download real.
//
// Quando o backend existir, basta substituir a implementação por um
// fetch da URL assinada do arquivo:
//
//   const res = await fetch(url);
//   const blob = await res.blob();
//   triggerBlobDownload(blob, nome);

const PLACEHOLDER_TEXT = (nome: string) =>
  `Arquivo: ${nome}\n\n` +
  `Este é um placeholder de download gerado pelo ambiente de demonstração ` +
  `do sistema Peticiona.\n\nQuando o backend estiver conectado, este download ` +
  `entregará o conteúdo real do arquivo enviado.\n`;

const triggerBlobDownload = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera a URL após pequeno delay para garantir o início do download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadAnexoMock = (nome: string, mime?: string) => {
  const type = mime && mime.length > 0 ? mime : "application/octet-stream";
  const blob = new Blob([PLACEHOLDER_TEXT(nome)], { type });
  triggerBlobDownload(blob, nome);
};
