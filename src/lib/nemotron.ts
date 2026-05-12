async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>) 
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export interface NemotronMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NemotronRequest {
  model: string;
  messages: NemotronMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface NemotronResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NemotronStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason?: 'stop' | 'length' | 'content_filter';
  }>;
}

class NemotronService {
  private readonly baseURL = '/api/nemotron';
  private readonly defaultModel = 'nemotron3-super-22b-instruct';

  async generateResponse(
    messages: NemotronMessage[],
    options: Partial<NemotronRequest> = {}
  ): Promise<NemotronResponse> {
    const requestBody: NemotronRequest = {
      model: this.defaultModel,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
      ...options,
    };

    try {
      const response = await request<NemotronResponse>(
        `${this.baseURL}/chat/completions`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );
      return response;
    } catch (error) {
      console.error('Nemotron API error:', error);
      throw new Error('Failed to generate response from Nemotron');
    }
  }

  async generateResponseStream(
    messages: NemotronMessage[],
    options: Partial<NemotronRequest> = {},
    onChunk: (chunk: NemotronStreamChunk) => void
  ): Promise<void> {
    const request: NemotronRequest = {
      model: this.defaultModel,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.9,
      stream: true,
      ...options,
    };

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const chunk = JSON.parse(data) as NemotronStreamChunk;
              onChunk(chunk);
            } catch (e) {
              console.warn('Failed to parse chunk:', data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Nemotron streaming error:', error);
      throw new Error('Failed to stream response from Nemotron');
    }
  }

  // Legal-specific prompts
  async generateLegalDocument(
    documentType: string,
    details: string,
    context?: string
  ): Promise<string> {
    const systemPrompt = `Você é um assistente jurídico especializado na elaboração de documentos legais no Brasil. 
    Gere documentos profissionais, claros e em conformidade com a legislação brasileira.
    Use linguagem formal jurídica e estruture o documento de forma lógica e organizada.`;

    const userPrompt = `Elabore um ${documentType} com as seguintes informações:
    
    Detalhes: ${details}
    ${context ? `Contexto adicional: ${context}` : ''}
    
    Por favor, gere um documento completo e profissional.`;

    const response = await this.generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return response.choices[0]?.message?.content || '';
  }

  async analyzeLegalText(
    text: string,
    analysisType: 'risks' | 'opportunities' | 'compliance' | 'general'
  ): Promise<string> {
    const systemPrompts = {
      risks: 'Analise o texto jurídico e identifique potenciais riscos legais, pontos de atenção e recomendações de mitigação.',
      opportunities: 'Analise o texto jurídico e identifique oportunidades, pontos favoráveis e estratégias de maximização de benefícios.',
      compliance: 'Verifique a conformidade do texto com a legislação brasileira aplicável e aponte possíveis não conformidades.',
      general: 'Forneça uma análise jurídica completa do texto, incluindo pontos principais, implicações e recomendações.'
    };

    const response = await this.generateResponse([
      { role: 'system', content: systemPrompts[analysisType] },
      { role: 'user', content: text },
    ]);

    return response.choices[0]?.message?.content || '';
  }

  async generateLegalAdvice(
    situation: string,
    area: string,
    urgency: 'low' | 'medium' | 'high'
  ): Promise<string> {
    const systemPrompt = `Você é um advogado experiente fornecendo orientação jurídica preliminar.
    Forneça informações claras sobre a situação, possíveis caminhos, e recomendações.
    Sempre inclua uma nota sobre a importância de consultar um advogado para análise completa.`;

    const urgencyContext = {
      low: 'Análise detalhada e abrangente',
      medium: 'Análise focada nos pontos críticos',
      high: 'Análise urgente com recomendações imediatas'
    };

    const userPrompt = `Situação: ${situation}
    Área do Direito: ${area}
    Nível de Urgência: ${urgencyContext[urgency]}
    
    Por favor, forneça orientação jurídica preliminar para esta situação.`;

    const response = await this.generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return response.choices[0]?.message?.content || '';
  }
}

export const nemotronService = new NemotronService();
