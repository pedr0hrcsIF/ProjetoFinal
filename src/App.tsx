import React, { useState, useEffect, useRef } from 'react';
import { MessageSquareCode } from 'lucide-react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message, ChatState, UserData } from './types/chat';

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  });

  const [initialized, setInitialized] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    budget: null,
    city: null,
    investmentType: null,
    targetAudience: null,
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);

      const initialMessages: Message[] = [
        {
          id: '1',
          content: 'Olá, seja bem-vindo ao assistente do LocalAItycs! Vamos buscar a melhor opção de localização para seu negócio. Para isso, precisamos de alguns dados.',
          role: 'assistant',
          timestamp: new Date(),
        },
        {
          id: '2',
          content: 'Para começar, qual o seu orçamento?',
          role: 'assistant',
          timestamp: new Date(),
        },
      ];

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, ...initialMessages],
      }));
    }
  }, [initialized]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatState.messages]);

  const saveUserData = async (completeUserData: UserData) => {
    try {
      const response = await fetch('http://localhost:3000/api/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget: completeUserData.budget,
          city: completeUserData.city,
          investmentType: completeUserData.investmentType,
          targetAudience: completeUserData.targetAudience,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save user data');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  };

  const callAIApi = async (completeUserData: UserData) => {
    try {
      console.log('Calling AI API with data:', completeUserData);
      
      const response = await fetch('http://localhost:3000/api/proxy/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget: completeUserData.budget,
          city: completeUserData.city,
          investmentType: completeUserData.investmentType,
          targetAudience: completeUserData.targetAudience,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error response:', errorText);
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      console.log('AI API response:', data);

      if (!data || !data.message) {
        throw new Error('Invalid response format from AI API');
      }

      return data;
    } catch (error) {
      console.error('Error calling AI API:', error);
      throw error;
    }
  };

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    let responseMessage = '';
    let updatedUserData = { ...userData };

    try {
      if (userData.budget === null) {
        const budgetValue = content.trim().match(/^\d+(\.\d+)?$/) ? parseFloat(content) : NaN;

        if (isNaN(budgetValue) || budgetValue <= 0) {
          responseMessage = 'Por favor, insira um valor numérico válido para o orçamento.';
        } else {
          updatedUserData = { ...updatedUserData, budget: budgetValue };
          responseMessage = 'Em qual cidade seu negócio será localizado?';
        }
      } else if (userData.city === null) {
        updatedUserData = { ...updatedUserData, city: content.trim() };
        responseMessage = 'Obrigado! Agora, qual o tipo de investimento? Exemplo: Sorveteria, Escola de idiomas, Lanchonete, etc.';
      } else if (userData.investmentType === null) {
        updatedUserData = { ...updatedUserData, investmentType: content.trim() };
        responseMessage = 'Ótimo! Agora, qual será o público-alvo do seu negócio? Exemplo: Jovens universitários, famílias, profissionais liberais, etc.';
      } else if (userData.targetAudience === null) {
        updatedUserData = { ...updatedUserData, targetAudience: content.trim() };
        
        // Save data and call AI API when all data is collected
        const savedData = await saveUserData(updatedUserData);
        console.log('Data saved successfully:', savedData);
        
        responseMessage = 'Perfeito! Processando suas informações para encontrar as melhores opções para seu negócio...';
        
        // Add processing message
        const processingMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: responseMessage,
          role: 'assistant',
          timestamp: new Date(),
        };
        
        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, processingMessage],
        }));
        
        // Call AI API
        const aiResponse = await callAIApi(updatedUserData);
        
        // Add AI response to chat
        if (aiResponse && aiResponse.message) {
          const aiMessage: Message = {
            id: (Date.now() + 2).toString(),
            content: aiResponse.message,
            role: 'assistant',
            timestamp: new Date(),
          };
          
          setChatState(prev => ({
            ...prev,
            messages: [...prev.messages, aiMessage],
            isLoading: false,
          }));
          
          // Early return since we've already handled the state updates
          setUserData(updatedUserData);
          return;
        }
      }

      setUserData(updatedUserData);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responseMessage,
        role: 'assistant',
        timestamp: new Date(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
      }));
    }
  };

  return (
    <div 
    className="min-h-screen bg-cover bg-center bg-no-repeat relative"
    style={{
      backgroundImage: `url('/media/background.jpg')`,
    }}
  >
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-gray-800 rounded-t-lg p-4 border-b border-gray-700 flex items-center gap-2">
          <div className="bg-blue-500 p-2 rounded-full">
            <MessageSquareCode className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-white">LocalAItycs Assistant</h1>
        </div>
        <div 
          ref={chatContainerRef}
          className="bg-gray-800 h-[70vh] overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar"
        >
          {chatState.messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              Envie uma mensagem para iniciar a conversa
            </div>
          ) : (
            chatState.messages.map((message, index) => (
              <div
                key={message.id}
                className="message-appear"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <ChatMessage message={message} />
              </div>
            ))
          )}
        </div>
        <div className="bg-gray-800 rounded-b-lg p-4 border-t border-gray-700">
          <ChatInput
            onSendMessage={sendMessage}
            disabled={chatState.isLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default App;