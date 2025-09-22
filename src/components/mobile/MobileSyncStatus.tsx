import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMobileDevice, forceMobileRefresh, getMobileNetworkType } from '@/lib/mobileUtils';
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import { AnimatePresence, motion } from 'framer-motion';

interface MobileSyncStatusProps {
  compact?: boolean;
}

export const MobileSyncStatus = ({ compact = false }: MobileSyncStatusProps) => {
  const { user } = useAuth();
  const { isOffline, loading, error, refreshTransactions } = useTransactions();
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSyncCard, setShowSyncCard] = useState(false);
  const isMobile = isMobileDevice();

  // Update network type periodically
  useEffect(() => {
    const updateNetworkType = () => {
      setNetworkType(getMobileNetworkType());
    };

    updateNetworkType();
    const interval = setInterval(updateNetworkType, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-hide sync card after successful refresh
  useEffect(() => {
    if (!loading && !error && lastRefreshTime) {
      const timer = setTimeout(() => setShowSyncCard(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [loading, error, lastRefreshTime]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setShowSyncCard(true);
    
    try {
      await refreshTransactions();
      setLastRefreshTime(new Date());
      console.log('📱 [SYNC] Manual refresh completed');
    } catch (error) {
      console.error('📱 [SYNC] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceRefresh = () => {
    console.log('📱 [SYNC] Force refresh initiated');
    forceMobileRefresh();
  };

  const getSyncStatus = () => {
    if (isOffline) return { status: 'offline', color: 'destructive', icon: WifiOff };
    if (loading || isRefreshing) return { status: 'syncing', color: 'warning', icon: RefreshCw };
    if (error) return { status: 'error', color: 'destructive', icon: AlertCircle };
    if (lastRefreshTime) return { status: 'synced', color: 'success', icon: CheckCircle };
    return { status: 'idle', color: 'secondary', icon: Clock };
  };

  const getStatusText = () => {
    const { status } = getSyncStatus();
    switch (status) {
      case 'offline': return 'Hors ligne';
      case 'syncing': return 'Synchronisation...';
      case 'error': return 'Erreur de sync';
      case 'synced': return `Synchronisé ${lastRefreshTime?.toLocaleTimeString()}`;
      default: return 'En attente';
    }
  };

  const { status, color, icon: StatusIcon } = getSyncStatus();

  // Don't show on desktop unless forced
  if (!isMobile && !compact) return null;

  // Compact mode for header
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className="flex items-center gap-1 text-xs"
        >
          <StatusIcon 
            className={cn(
              "w-3 h-3",
              (loading || isRefreshing) && "animate-spin"
            )}
          />
          {isOffline && <span className="text-xs">Hors ligne</span>}
        </Button>
        
        {isOffline && (
          <Badge variant="destructive" className="text-xs">
            <WifiOff className="w-2 h-2 mr-1" />
            Offline
          </Badge>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Always visible sync button for mobile */}
      {isMobile && (
        <div className="fixed bottom-20 right-4 z-40">
          <Button
            onClick={() => setShowSyncCard(true)}
            size="sm"
            variant="outline"
            className={cn(
              "rounded-full shadow-lg bg-card border-border",
              "flex items-center gap-2 px-3 py-2"
            )}
          >
            <StatusIcon 
              className={cn(
                "w-4 h-4",
                color === 'success' && "text-success",
                color === 'destructive' && "text-destructive",
                color === 'warning' && "text-orange-500",
                (loading || isRefreshing) && "animate-spin"
              )}
            />
            <Smartphone className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Sync status card */}
      <AnimatePresence>
        {showSyncCard && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50"
          >
            <Card className="p-4 shadow-xl bg-card/95 backdrop-blur-sm border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusIcon 
                    className={cn(
                      "w-5 h-5",
                      color === 'success' && "text-success",
                      color === 'destructive' && "text-destructive",
                      color === 'warning' && "text-orange-500",
                      (loading || isRefreshing) && "animate-spin"
                    )}
                  />
                  <span className="font-medium text-sm">État de synchronisation</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSyncCard(false)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Status:</span>
                  <Badge variant={color === 'success' ? 'default' : color as any}>
                    {getStatusText()}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Connexion:</span>
                  <div className="flex items-center gap-1">
                    {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                    <span className="text-xs">{networkType}</span>
                  </div>
                </div>

                {user && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Utilisateur:</span>
                    <span className="text-xs truncate max-w-32">{user.email}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing || loading}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className={cn("w-3 h-3 mr-1", (isRefreshing || loading) && "animate-spin")} />
                    Actualiser
                  </Button>
                  
                  <Button
                    onClick={handleForceRefresh}
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Forcer
                  </Button>
                </div>

                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {error}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};