import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gmb_token');
    const savedUser = localStorage.getItem('gmb_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token, username: user } = res.data;
    localStorage.setItem('gmb_token', token);
    localStorage.setItem('gmb_user', JSON.stringify({ username: user }));
    setUser({ username: user });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('gmb_token');
    localStorage.removeItem('gmb_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
