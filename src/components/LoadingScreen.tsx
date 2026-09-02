import React, { useState, useEffect } from 'react';

export interface LoadingMessage {
  text: string;
  subtext: string;
}

export const LOADING_MESSAGES: LoadingMessage[] = [
  { text: 'Organizando tus finanzas...', subtext: 'Todo bajo control 💪' },
  { text: 'Preparando tu dashboard...', subtext: 'Tus datos están seguros 🔒' },
  { text: 'Calculando tus balances...', subtext: 'Cada bolívar cuenta 💰' },
  { text: 'Sincronizando información...', subtext: 'Actualizado al instante ⚡' },
  { text: 'Cargando tu información...', subtext: 'Bienvenido de vuelta 👋' },
  { text: 'Verificando tus metas...', subtext: 'Vas por buen camino 🎯' },
  { text: 'Actualizando tus registros...', subtext: 'Todo al día 📊' },
  { text: 'Preparando tu quincena...', subtext: 'Listo para planificar 📅' },
  { text: 'Revisando tus gastos...', subtext: 'Transparencia total 🔍' },
  { text: 'Conectando con la nube...', subtext: 'Accede desde cualquier lugar ☁️' },
];

const getRandomMessage = (): LoadingMessage => {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
};

interface LoadingScreenProps {
  initialMessage?: string;
  initialSubtext?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  initialMessage,
  initialSubtext,
}) => {
  const [currentMessage, setCurrentMessage] = useState<LoadingMessage>(() => {
    if (initialMessage) {
      return { text: initialMessage, subtext: initialSubtext || 'Bienvenido a LANITAPP 🚀' };
    }
    return getRandomMessage();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage(getRandomMessage());
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0B132B] flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="relative mb-6">
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#147DF0] to-[#00C2C7] blur-xl opacity-30 animate-pulse" />
        <div className="relative h-20 w-20 rounded-3xl bg-surface/40 border border-white/10 flex items-center justify-center p-3.5 shadow-2xl backdrop-blur-md">
          <img src="/icon.png" alt="LANITAPP" className="h-full w-full object-contain drop-shadow-md" />
        </div>
      </div>

      <div className="text-center space-y-1.5 max-w-xs transition-all duration-300">
        <p className="text-base font-bold text-white tracking-wide animate-pulse">
          {currentMessage.text}
        </p>
        <p className="text-xs text-slate-400 font-medium">
          {currentMessage.subtext}
        </p>
      </div>

      {/* Modern Wave Spinner Indicator */}
      <div className="mt-6 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#147DF0] animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 rounded-full bg-[#00C2C7] animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 rounded-full bg-[#147DF0] animate-bounce" />
      </div>
    </div>
  );
};
