from __future__ import annotations

import os
import json
import httpx
from typing import Dict, Any, List, Optional, AsyncGenerator
from flask import current_app


class NemotronService:
    """Service for interacting with NVIDIA Nemotron 3 Super via NIM."""
    
    def __init__(self):
        self.base_url = os.getenv('NEMOTRON_NIM_URL', 'http://localhost:8000')
        self.default_model = os.getenv('NEMOTRON_MODEL', 'nemotron3-super-22b-instruct')
        self.timeout = int(os.getenv('NEMOTRON_TIMEOUT', '60'))
        
    async def _make_request(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP request to Nemotron NIM API."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=data,
                    headers={
                        "Content-Type": "application/json",
                    }
                )
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            current_app.logger.error(f"Timeout connecting to Nemotron at {url}")
            raise NemotronServiceError("Timeout ao conectar com o serviço Nemotron")
        except httpx.HTTPStatusError as e:
            current_app.logger.error(f"HTTP error from Nemotron: {e.response.status_code} - {e.response.text}")
            raise NemotronServiceError(f"Erro HTTP do Nemotron: {e.response.status_code}")
        except httpx.RequestError as e:
            current_app.logger.error(f"Request error to Nemotron: {str(e)}")
            raise NemotronServiceError(f"Erro de conexão com o Nemotron: {str(e)}")
        except Exception as e:
            current_app.logger.error(f"Unexpected error calling Nemotron: {str(e)}")
            raise NemotronServiceError(f"Erro inesperado: {str(e)}")
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Generate chat completion using Nemotron."""
        
        # Validate messages
        if not messages or not isinstance(messages, list):
            raise NemotronServiceError("Messages must be a non-empty list")
        
        for message in messages:
            if not isinstance(message, dict) or 'role' not in message or 'content' not in message:
                raise NemotronServiceError("Each message must have 'role' and 'content' fields")
            
            if message['role'] not in ['system', 'user', 'assistant']:
                raise NemotronServiceError("Message role must be 'system', 'user', or 'assistant'")
        
        request_data = {
            "model": model or self.default_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "stream": stream
        }
        
        return await self._make_request("/v1/chat/completions", request_data)
    
    async def stream_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream chat completion using Nemotron."""
        
        # Validate messages (same as above)
        if not messages or not isinstance(messages, list):
            raise NemotronServiceError("Messages must be a non-empty list")
        
        for message in messages:
            if not isinstance(message, dict) or 'role' not in message or 'content' not in message:
                raise NemotronServiceError("Each message must have 'role' and 'content' fields")
            
            if message['role'] not in ['system', 'user', 'assistant']:
                raise NemotronServiceError("Message role must be 'system', 'user', or 'assistant'")
        
        request_data = {
            "model": model or self.default_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "stream": True
        }
        
        url = f"{self.base_url}/v1/chat/completions"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    url,
                    json=request_data,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    response.raise_for_status()
                    
                    buffer = ""
                    async for chunk in response.aiter_text():
                        buffer += chunk
                        lines = buffer.split('\n')
                        buffer = lines.pop() or ""
                        
                        for line in lines:
                            line = line.strip()
                            if line == '' or not line.startswith('data: '):
                                continue
                            
                            data = line[6:]  # Remove 'data: ' prefix
                            if data == '[DONE]':
                                return
                            
                            try:
                                chunk_data = json.loads(data)
                                yield chunk_data
                            except json.JSONDecodeError:
                                current_app.logger.warning(f"Failed to parse chunk: {data}")
                                continue
                                
        except httpx.TimeoutException:
            current_app.logger.error(f"Timeout streaming from Nemotron at {url}")
            raise NemotronServiceError("Timeout ao conectar com o serviço Nemotron")
        except httpx.HTTPStatusError as e:
            current_app.logger.error(f"HTTP error streaming from Nemotron: {e.response.status_code}")
            raise NemotronServiceError(f"Erro HTTP do Nemotron: {e.response.status_code}")
        except httpx.RequestError as e:
            current_app.logger.error(f"Request error streaming from Nemotron: {str(e)}")
            raise NemotronServiceError(f"Erro de conexão com o Nemotron: {str(e)}")
        except Exception as e:
            current_app.logger.error(f"Unexpected error streaming from Nemotron: {str(e)}")
            raise NemotronServiceError(f"Erro inesperado: {str(e)}")
    
    async def generate_legal_document(
        self,
        document_type: str,
        details: str,
        context: Optional[str] = None
    ) -> str:
        """Generate a legal document using Nemotron."""
        
        system_prompt = """Você é um assistente jurídico especializado na elaboração de documentos legais no Brasil. 
        Gere documentos profissionais, claros e em conformidade com a legislação brasileira.
        Use linguagem formal jurídica e estruture o documento de forma lógica e organizada."""
        
        user_prompt = f"""Elabore um {document_type} com as seguintes informações:
        
        Detalhes: {details}
        {f'Contexto adicional: {context}' if context else ''}
        
        Por favor, gere um documento completo e profissional."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = await self.chat_completion(messages)
        return response.get("choices", [{}])[0].get("message", {}).get("content", "")
    
    async def analyze_legal_text(
        self,
        text: str,
        analysis_type: str = "general"
    ) -> str:
        """Analyze legal text using Nemotron."""
        
        system_prompts = {
            "risks": "Analise o texto jurídico e identifique potenciais riscos legais, pontos de atenção e recomendações de mitigação.",
            "opportunities": "Analise o texto jurídico e identifique oportunidades, pontos favoráveis e estratégias de maximização de benefícios.",
            "compliance": "Verifique a conformidade do texto com a legislação brasileira aplicável e aponte possíveis não conformidades.",
            "general": "Forneça uma análise jurídica completa do texto, incluindo pontos principais, implicações e recomendações."
        }
        
        system_prompt = system_prompts.get(analysis_type, system_prompts["general"])
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        
        response = await self.chat_completion(messages)
        return response.get("choices", [{}])[0].get("message", {}).get("content", "")
    
    async def generate_legal_advice(
        self,
        situation: str,
        area: str,
        urgency: str = "medium"
    ) -> str:
        """Generate legal advice using Nemotron."""
        
        system_prompt = """Você é um advogado experiente fornecendo orientação jurídica preliminar.
        Forneça informações claras sobre a situação, possíveis caminhos, e recomendações.
        Sempre inclua uma nota sobre a importância de consultar um advogado para análise completa."""
        
        urgency_context = {
            "low": "Análise detalhada e abrangente",
            "medium": "Análise focada nos pontos críticos",
            "high": "Análise urgente com recomendações imediatas"
        }
        
        user_prompt = f"""Situação: {situation}
        Área do Direito: {area}
        Nível de Urgência: {urgency_context.get(urgency, "Análise padrão")}
        
        Por favor, forneça orientação jurídica preliminar para esta situação."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = await self.chat_completion(messages)
        return response.get("choices", [{}])[0].get("message", {}).get("content", "")


class NemotronServiceError(Exception):
    """Custom exception for Nemotron service errors."""
    pass


# Singleton instance
nemotron_service = NemotronService()
