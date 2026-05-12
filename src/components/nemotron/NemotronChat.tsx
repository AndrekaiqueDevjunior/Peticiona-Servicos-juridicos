import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Send, Bot, User, Loader2, FileText, Scale, AlertTriangle } from 'lucide-react';
import { nemotronService, NemotronMessage } from '@/lib/nemotron';
import { toast } from 'sonner';

interface NemotronChatProps {
  className?: string;
  initialContext?: string;
  legalArea?: string;
}

interface ChatMessage extends NemotronMessage {
  id: string;
  timestamp: Date;
}

const NemotronChat: React.FC<NemotronChatProps> = ({ 
  className, 
  initialContext,
  legalArea 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialContext) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'system',
        content: `Contexto inicial: ${initialContext}${legalArea ? `\nÁrea do Direito: ${legalArea}` : ''}`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [initialContext, legalArea]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingText('');

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      await nemotronService.generateResponseStream(
        [...conversationHistory, userMessage],
        {},
        (chunk) => {
          const content = chunk.choices[0]?.delta?.content || '';
          setStreamingText(prev => prev + content);
        }
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: streamingText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingText('');
    } catch (error) {
      console.error('Error generating response:', error);
      toast.error('Erro ao gerar resposta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getQuickActions = () => [
    {
      label: 'Analisar Documento',
      icon: <FileText className="w-4 h-4" />,
      action: () => setInput('Analise este documento jurídico e aponte os principais pontos de atenção.')
    },
    {
      label: 'Consultar Legislação',
      icon: <Scale className="w-4 h-4" />,
      action: () => setInput('Quais são as principais leis aplicáveis a este caso?')
    },
    {
      label: 'Identificar Riscos',
      icon: <AlertTriangle className="w-4 h-4" />,
      action: () => setInput('Identifique os possíveis riscos jurídicos nesta situação.')
    }
  ];

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Assistente Jurídico IA - Nemotron 3 Super
          <Badge variant="outline">Beta</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-[600px]">
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 mb-4 p-4 border rounded-md"
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.role === 'system'
                      ? 'bg-gray-100 text-gray-600 text-sm'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 text-gray-900">
                  <div className="whitespace-pre-wrap break-words">
                    {streamingText}
                    <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                  </div>
                </div>
              </div>
            )}

            {isLoading && !streamingText && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Processando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator className="mb-4" />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {getQuickActions().map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={action.action}
                className="text-xs"
                disabled={isLoading}
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua pergunta ou solicitação jurídica..."
              className="flex-1 min-h-[80px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="self-end"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NemotronChat;
