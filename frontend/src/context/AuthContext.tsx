import React, { createContext, useContext, useState } from 'react';

type Role = null | 'professional';

interface AuthCtx {
  role: Role;
  login:  (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  role: null,
  login: () => false,
  logout: () => {},
});

// Simple password gate — no backend needed for this demo.
// Change this value to whatever password you want.
const PROFESSIONAL_PASSWORD = 'loanpro123';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);

  const login = (password: string): boolean => {
    if (password === PROFESSIONAL_PASSWORD) {
      setRole('professional');
      return true;
    }
    return false;
  };

  const logout = () => setRole(null);

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
