import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

interface UseLogoUploadReturn {
  uploadLogo: (file: File, userId: string) => Promise<string | null>;
  deleteLogo: (logoUrl: string, userId: string) => Promise<boolean>;
  isUploading: boolean;
}

export function useLogoUpload(): UseLogoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadLogo = async (file: File, userId: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Validation
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast.error(new Error("Fichier trop volumineux (max 2MB)"));
        return null;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(new Error("Format non supporté. Formats acceptés : JPG, PNG, WEBP"));
        return null;
      }

      // 1. Récupérer l'ancien logo depuis le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_logo_url')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        logger.error('Error fetching profile:', profileError);
      }

      // 2. Supprimer l'ancien logo du storage s'il existe
      if (profile?.company_logo_url) {
        try {
          const urlParts = profile.company_logo_url.split('/company-logos/');
          if (urlParts.length >= 2) {
            const oldFilePath = urlParts[1];
            logger.info('Deleting old logo:', oldFilePath);
            
            const { error: deleteError } = await supabase.storage
              .from('company-logos')
              .remove([oldFilePath]);

            if (deleteError) {
              logger.warn('Could not delete old logo (may not exist):', deleteError);
              // Ne pas bloquer l'upload si la suppression échoue
            } else {
              logger.info('Old logo deleted successfully');
            }
          }
        } catch (error) {
          logger.warn('Error during old logo deletion:', error);
          // Ne pas bloquer l'upload si la suppression échoue
        }
      }

      // 3. Générer un nom de fichier unique avec timestamp pour éviter les conflits de cache
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${userId}/logo-${timestamp}.${fileExt}`;

      // 4. Upload vers Storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          cacheControl: '3600'
        });

      if (uploadError) {
        logger.error('Error uploading logo:', uploadError);
        throw uploadError;
      }

      // 5. Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      // 6. Mettre à jour le profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_logo_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Error updating profile:', updateError);
        throw updateError;
      }

      toast.success("Logo mis à jour. Il apparaîtra sur vos factures");

      return publicUrl;
    } catch (error) {
      logger.error('Logo upload failed:', error);
      toast.error(error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLogo = async (logoUrl: string, userId: string): Promise<boolean> => {
    try {
      setIsUploading(true);

      // Extraire le chemin du fichier depuis l'URL
      const urlParts = logoUrl.split('/company-logos/');
      if (urlParts.length < 2) {
        throw new Error('Invalid logo URL');
      }
      const filePath = urlParts[1];

      // Supprimer du Storage
      const { error: deleteError } = await supabase.storage
        .from('company-logos')
        .remove([filePath]);

      if (deleteError) {
        logger.error('Error deleting logo:', deleteError);
        throw deleteError;
      }

      // Mettre à jour le profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_logo_url: null })
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Error updating profile:', updateError);
        throw updateError;
      }

      toast.success("Logo supprimé. Le logo par défaut sera utilisé");

      return true;
    } catch (error) {
      logger.error('Logo deletion failed:', error);
      toast.error(error);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadLogo,
    deleteLogo,
    isUploading
  };
}
