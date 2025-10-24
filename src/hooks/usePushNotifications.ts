import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface PushNotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
  subscription: PushSubscription | null;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSupported: false,
    subscription: null,
  });

  useEffect(() => {
    // Vérifier le support des notifications
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    
    if (isSupported) {
      setState(prev => ({
        ...prev,
        permission: Notification.permission,
        isSupported: true,
      }));
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      logger.warn('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission === 'granted') {
        await subscribeToPush();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const subscribeToPush = async (): Promise<PushSubscription | null> => {
    if (!state.isSupported || state.permission !== 'granted') {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Vérifier si déjà abonné
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // VAPID public key (à générer plus tard via backend)
        // Pour l'instant, on prépare juste la structure
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            // Cette clé sera fournie par le backend
            import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
          ) as BufferSource,
        });

        setState(prev => ({ ...prev, subscription }));
        
        // TODO: Envoyer la subscription au backend pour stockage
        logger.info('Push subscription created');
      }

      return subscription;
    } catch (error) {
      logger.error('Error subscribing to push:', error);
      return null;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!state.subscription) return false;

    try {
      await state.subscription.unsubscribe();
      setState(prev => ({ ...prev, subscription: null }));
      
      // TODO: Notifier le backend de la désinscription
      logger.info('Push subscription removed');
      return true;
    } catch (error) {
      logger.error('Error unsubscribing from push:', error);
      return false;
    }
  };

  const showNotification = async (title: string, options?: NotificationOptions) => {
    if (!state.isSupported || state.permission !== 'granted') {
      logger.warn('Cannot show notification: not supported or not permitted');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
    } catch (error) {
      logger.error('Error showing notification:', error);
    }
  };

  return {
    permission: state.permission,
    isSupported: state.isSupported,
    isSubscribed: !!state.subscription,
    requestPermission,
    subscribeToPush,
    unsubscribe,
    showNotification,
  };
};

// Utilitaire pour convertir la clé VAPID
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) return new Uint8Array();
  
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
