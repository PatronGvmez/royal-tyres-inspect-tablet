import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Crown, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Crown className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-foreground text-base">Royal Tyres</span>
      </div>
      <div className="text-center max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">404 — Not Found</p>
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </button>
      </div>
    </div>
  );
};

export default NotFound;
