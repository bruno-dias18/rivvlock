import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaskedVatInput } from '@/components/ui/masked-vat-input';
import { MaskedUidInput } from '@/components/ui/masked-uid-input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { toast } from 'sonner';
import { vatNumberSchema } from '@/lib/validations';

const createProfileSchema = (country: 'FR' | 'CH', isSubjectToVat: boolean) => {
  const baseSchema = z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    postal_code: z.string().optional(),
    city: z.string().optional(),
    company_name: z.string().optional(),
    company_address: z.string().optional(),
    siret_uid: z.string().optional(),
    avs_number: z.string().optional(),
    is_subject_to_vat: z.boolean().optional(),
    vat_number: z.string().optional(),
    tva_rate: z.string().optional(),
    vat_rate: z.string().optional(),
  });

  if (isSubjectToVat) {
    return baseSchema.superRefine((data, ctx) => {
      if (data.is_subject_to_vat && (!data.vat_number || !vatNumberSchema(country).safeParse(data.vat_number).success)) {
        ctx.addIssue({
          path: ['vat_number'],
          code: 'custom',
          message: country === 'FR'
            ? 'Le numéro de TVA est obligatoire et doit être au format FRXX123456789'
            : 'Le numéro de TVA est obligatoire et doit être au format CHE-XXX.XXX.XXX TVA'
        });
      }
    });
  }

  return baseSchema;
};

type ProfileFormData = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  company_name?: string;
  company_address?: string;
  siret_uid?: string;
  avs_number?: string;
  is_subject_to_vat?: boolean;
  vat_number?: string;
  tva_rate?: string;
  vat_rate?: string;
};

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  onProfileUpdated: () => void;
}

export function EditProfileDialog({ open, onOpenChange, profile, onProfileUpdated }: EditProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customVatRate, setCustomVatRate] = useState('');
  const { user } = useAuth();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(createProfileSchema(profile?.country || 'FR', false)),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      address: '',
      postal_code: '',
      city: '',
      company_name: '',
      company_address: '',
      siret_uid: '',
      avs_number: '',
      is_subject_to_vat: false,
      vat_number: '',
      tva_rate: '',
      vat_rate: '',
    },
  });

  // Update form when profile changes and set VAT defaults
  useEffect(() => {
    if (profile && open) {
      const currentVatRate = profile?.country === 'FR' ? profile.tva_rate : profile.vat_rate;
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        postal_code: profile.postal_code || '',
        city: profile.city || '',
        company_name: profile.company_name || '',
        company_address: profile.company_address || '',
        siret_uid: profile.siret_uid || '',
        avs_number: profile.avs_number || '',
        is_subject_to_vat: profile.is_subject_to_vat || false,
        vat_number: profile.vat_number || '',
        tva_rate: profile?.country === 'FR' ? (currentVatRate?.toString() || '') : '',
        vat_rate: profile?.country === 'CH' ? (currentVatRate?.toString() || '') : '',
      });
      
      // Set custom VAT rate if it's not in predefined options
      if (currentVatRate) {
        const predefinedRates = profile?.country === 'FR' 
          ? ['20', '10', '5.5', '2.1']
          : ['8.1', '2.6', '3.8'];
        
        if (!predefinedRates.includes(currentVatRate.toString())) {
          setCustomVatRate(currentVatRate.toString());
          form.setValue(profile?.country === 'FR' ? 'tva_rate' : 'vat_rate', 'custom');
        }
      }
    }
  }, [profile, open, form]);

  // Watch for VAT checkbox changes and validate accordingly
  const watchedIsSubjectToVat = form.watch('is_subject_to_vat');
  useEffect(() => {
    if (watchedIsSubjectToVat) {
      // Trigger validation when VAT checkbox is checked
      form.trigger('vat_number');
    }
  }, [watchedIsSubjectToVat, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    
    // Manual VAT validation when subject to VAT
    if (data.is_subject_to_vat) {
      const vatValid = data.vat_number && vatNumberSchema(profile?.country || 'FR').safeParse(data.vat_number).success;
      if (!vatValid) {
        form.setError('vat_number', {
          type: 'manual',
          message: profile?.country === 'FR'
            ? 'Le numéro de TVA est obligatoire et doit être au format FRXX123456789'
            : 'Le numéro de TVA est obligatoire et doit être au format CHE-XXX.XXX.XXX TVA'
        });
        return;
      }
    }
    
    setIsLoading(true);
    try {
      // Convert rates to numbers if provided
      const updateData = {
        ...data,
        tva_rate: data.tva_rate && data.tva_rate !== '' && data.tva_rate !== 'custom' ? parseFloat(data.tva_rate) : null,
        vat_rate: data.vat_rate && data.vat_rate !== '' && data.vat_rate !== 'custom' ? parseFloat(data.vat_rate) : null,
      };

      // Handle custom VAT rate
      if (data.tva_rate === 'custom' || data.vat_rate === 'custom') {
        const customRate = parseFloat(customVatRate);
        if (profile?.country === 'FR') {
          updateData.tva_rate = customRate;
        } else if (profile?.country === 'CH') {
          updateData.vat_rate = customRate;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Erreur lors de la mise à jour du profil');
        console.error('Profile update error:', error);
        return;
      }

      toast.success('Profil mis à jour avec succès');
      onProfileUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le profil</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Informations personnelles</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input placeholder="Votre prénom" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input placeholder="Votre nom" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="Votre numéro de téléphone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Votre adresse complète"
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {profile?.user_type !== 'company' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 75001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Paris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Company Information - Only for companies */}
            {profile?.user_type === 'company' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Informations d'entreprise</h3>
                
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l'entreprise</FormLabel>
                      <FormControl>
                        <Input placeholder="Nom de votre entreprise" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse de l'entreprise</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Adresse du siège social"
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal du siège</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 75001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville du siège</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Paris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="siret_uid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {profile?.country === 'FR' ? 'Numéro SIRET' : 'Numéro UID'}
                      </FormLabel>
                      <FormControl>
                        {profile?.country === 'CH' ? (
                          <MaskedUidInput {...field} />
                        ) : (
                          <Input 
                            placeholder="14 chiffres"
                            {...field} 
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Tax Information - For both companies and independents */}
            {(profile?.user_type === 'company' || profile?.user_type === 'independent') && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Informations fiscales</h3>
                
                <FormField
                  control={form.control}
                  name="is_subject_to_vat"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center space-x-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.checked);
                              if (!e.target.checked) {
                                form.setValue('vat_number', '');
                                form.setValue('tva_rate', '');
                                form.setValue('vat_rate', '');
                              }
                            }}
                            className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                          />
                        </FormControl>
                        <FormLabel>
                          {profile?.country === 'FR' ? 'Assujetti à la TVA' : 'Assujetti à la TVA'}
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('is_subject_to_vat') && (
                  <>
                    <FormField
                      control={form.control}
                      name="vat_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numéro de TVA{form.watch('is_subject_to_vat') ? ' *' : ''}</FormLabel>
                          <FormControl>
                            <MaskedVatInput 
                              country={(profile?.country as 'FR' | 'CH') || 'FR'}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={profile?.country === 'FR' ? 'FR12345678901' : 'CHE-123.456.789 TVA'}
                            />
                          </FormControl>
                           <FormDescription>
                             {profile?.country === 'CH' 
                               ? "Numéro de TVA suisse" 
                               : "Numéro de TVA français"
                             }
                           </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={profile?.country === 'FR' ? 'tva_rate' : 'vat_rate'}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taux de TVA (%)</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez un taux" />
                              </SelectTrigger>
                              <SelectContent>
                                {profile?.country === 'FR' && (
                                  <>
                                    <SelectItem value="20">20% (Taux normal)</SelectItem>
                                    <SelectItem value="10">10% (Taux intermédiaire)</SelectItem>
                                    <SelectItem value="5.5">5,5% (Taux réduit)</SelectItem>
                                    <SelectItem value="2.1">2,1% (Taux super réduit)</SelectItem>
                                  </>
                                )}
                                {profile?.country === 'CH' && (
                                  <>
                                    <SelectItem value="8.1">8,1% (Taux normal)</SelectItem>
                                    <SelectItem value="2.6">2,6% (Taux réduit)</SelectItem>
                                    <SelectItem value="3.8">3,8% (Taux hébergement)</SelectItem>
                                  </>
                                )}
                                <SelectItem value="custom">Autre (saisie manuelle)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(form.watch('tva_rate') === 'custom' || form.watch('vat_rate') === 'custom') && (
                      <div>
                        <label className="block text-sm font-medium text-foreground">
                          Taux personnalisé (%)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="Taux personnalisé"
                          value={customVatRate}
                          onChange={(e) => setCustomVatRate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* AVS for Swiss users */}
              {profile?.country === 'CH' && profile?.user_type !== 'company' && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="avs_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro AVS</FormLabel>
                      <FormControl>
                        <Input placeholder="756.1234.5678.90" {...field} />
                      </FormControl>
                      <FormDescription>
                        Format : 756.XXXX.XXXX.XX
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}