import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check localStorage for the user session
    const user = localStorage.getItem('username');
    
    // If not logged in AND trying to access a protected page
    if (!user && router.pathname !== '/login') {
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  // Prevent "flicker" of protected content
  if (!authorized && router.pathname !== '/login') {
    return <div style={{padding:'50px', textAlign:'center'}}>Verifying Secure Session...</div>;
  }

  return <>{children}</>;
};

export default AuthGuard;