import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { RivvlockLogo } from '@/components/ui/lock-animation';
import { ArrowRight, Shield, Clock, CreditCard } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) return null;

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center space-y-8">
        <RivvlockLogo className="scale-150" />
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold gradient-text">
            RIVVLOCK
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Plateforme escrow sécurisée pour vos transactions commerciales
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            size="lg" 
            className="gradient-primary text-white"
            onClick={() => navigate('/auth')}
          >
            Commencer
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span>100% sécurisé</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Validation 24h</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <span>5% frais seulement</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;