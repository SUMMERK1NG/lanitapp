import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth.ts';
import type { UserProfile, UserRole } from '../types/index.ts';

interface AuthContextType {
  currentUser: UserProfile | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithCedula: (cedula: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: any) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (cedulaOrEmail: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refetchAuth: () => Promise<void>;
  changePassword?: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  checkCedulaExists?: (cedula: string) => Promise<boolean>;
  checkEmailExists?: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();

  const value: AuthContextType = {
    ...auth,
    profile: auth.currentUser,
    role: auth.currentUser?.role || null,
    isLoading: auth.loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
