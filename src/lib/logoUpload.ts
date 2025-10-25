import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Compress image if needed using Canvas API
 * Target: max 500KB, max dimensions 300x300px
 */
const compressImageIfNeeded = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Calculate new dimensions (max 300x300, preserve ratio)
      let width = img.width;
      let height = img.height;
      const maxDimension = 300;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to WebP if supported, otherwise PNG
      const mimeType = 'image/webp';
      const quality = 0.85;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // If compressed size is acceptable or smaller than original
            if (blob.size < 500000 || blob.size < file.size) {
              resolve(blob);
            } else {
              // Try with lower quality
              canvas.toBlob(
                (blob2) => {
                  resolve(blob2 || blob);
                },
                mimeType,
                0.7
              );
            }
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Upload company logo to Supabase Storage
 * Returns the public URL of the uploaded logo
 */
export const uploadCompanyLogo = async (file: File, userId: string): Promise<string> => {
  try {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Format invalide. Utilisez PNG, JPG ou WEBP.');
    }

    // Validate file size (2MB max before compression)
    if (file.size > 2097152) {
      throw new Error('Fichier trop volumineux. Maximum 2MB.');
    }

    // Compress image if needed
    const compressedBlob = await compressImageIfNeeded(file);

    // Determine file extension
    const extension = compressedBlob.type === 'image/webp' ? 'webp' : 'png';
    const fileName = `${userId}/logo.${extension}`;

    // Delete old logo if exists (to avoid storage bloat)
    try {
      const { data: existingFiles } = await supabase.storage
        .from('company-logos')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from('company-logos').remove(filesToDelete);
      }
    } catch (error) {
      // Non-blocking error, continue with upload
      logger.warn('Failed to delete old logo:', error);
    }

    // Upload new logo
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(fileName, compressedBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);

    // Add cache-busting parameter
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update profile with new logo URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ company_logo_url: publicUrl })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    logger.info('Company logo uploaded successfully');
    return publicUrl;
  } catch (error) {
    logger.error('Failed to upload company logo:', error);
    throw error;
  }
};

/**
 * Delete company logo from Supabase Storage
 */
export const deleteCompanyLogo = async (userId: string): Promise<void> => {
  try {
    // List all files in user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('company-logos')
      .list(userId);

    if (listError) {
      throw listError;
    }

    if (files && files.length > 0) {
      // Delete all files
      const filesToDelete = files.map((f) => `${userId}/${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from('company-logos')
        .remove(filesToDelete);

      if (deleteError) {
        throw deleteError;
      }
    }

    // Update profile to remove logo URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ company_logo_url: null })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    logger.info('Company logo deleted successfully');
  } catch (error) {
    logger.error('Failed to delete company logo:', error);
    throw error;
  }
};
