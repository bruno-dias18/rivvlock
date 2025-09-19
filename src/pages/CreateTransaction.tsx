import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Copy, Check } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const createTransactionSchema = z.object({
  title: z.string().min(1, 'Le titre est obligatoire'),
  description: z.string().min(1, 'La description est obligatoire'),
  price: z.coerce.number().min(0.01, 'Le prix doit être supérieur à 0'),
  currency: z.enum(['EUR', 'CHF'], { required_error: 'La devise est obligatoire' }),
  serviceDate: z.date({ required_error: 'La date de service est obligatoire' }),
});

type CreateTransactionForm = z.infer<typeof createTransactionSchema>;

export const CreateTransaction = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<CreateTransactionForm>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      currency: 'EUR',
    }
  });

  const onSubmit = async (data: CreateTransactionForm) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Generate unique token for shared link
      const token = crypto.randomUUID();
      const linkExpiresAt = new Date();
      linkExpiresAt.setDate(linkExpiresAt.getDate() + 30); // Link expires in 30 days

      // Calculate payment deadline (day before service date)
      const paymentDeadline = new Date(data.serviceDate);
      paymentDeadline.setDate(paymentDeadline.getDate() - 1); // Day before service date
      paymentDeadline.setHours(23, 59, 59, 999); // End of day before service date
      
      console.log('Test: CreateTransaction - Service date:', data.serviceDate);
      console.log('Test: CreateTransaction - Payment deadline:', paymentDeadline);
      
      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            title: data.title,
            description: data.description,
            price: data.price,
            currency: data.currency,
            service_date: data.serviceDate.toISOString(),
            shared_link_token: token,
            link_expires_at: linkExpiresAt.toISOString(),
            payment_deadline: paymentDeadline.toISOString(),
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const shareableLink = `${import.meta.env.VITE_APP_URL || window.location.origin}/join-transaction/${token}`;
      setGeneratedLink(shareableLink);
      
      console.log('Test: CreateTransaction - Generated payment link:', shareableLink);

      toast({
        title: 'Transaction créée !',
        description: 'Votre lien de paiement est prêt à être partagé.',
      });

    } catch (error) {
      console.error('Error creating transaction:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer la transaction. Veuillez réessayer.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      toast({
        title: 'Lien copié !',
        description: 'Le lien a été copié dans le presse-papiers.',
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de copier le lien.',
      });
    }
  };

  if (generatedLink) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl gradient-text">Transaction créée avec succès !</CardTitle>
              <CardDescription>
                Partagez ce lien avec votre client pour qu'il puisse procéder au paiement sécurisé.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <p className="text-sm font-medium mb-2">Lien de paiement :</p>
                <div className="flex items-center gap-2 p-3 bg-background border rounded-lg">
                  <code className="flex-1 text-sm break-all">{generatedLink}</code>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={copyToClipboard}
                    className="shrink-0"
                  >
                    {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={() => navigate('/transactions')} variant="outline" className="flex-1">
                  Voir mes transactions
                </Button>
                <Button 
                  onClick={() => {
                    setGeneratedLink(null);
                    form.reset();
                  }} 
                  className="flex-1 gradient-primary text-white"
                >
                  Créer une nouvelle transaction
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Créer une transaction</h1>
          <p className="text-muted-foreground mt-1">
            Créez une transaction sécurisée et générez un lien de paiement pour votre client.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Détails de la transaction</CardTitle>
            <CardDescription>
              Remplissez les informations nécessaires pour créer votre transaction escrow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre de la transaction</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: Consultation IT, Formation React..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description détaillée</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Décrivez précisément les services à fournir..." 
                          className="resize-none" 
                          rows={4}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="0.00" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Devise</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir la devise" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="CHF">CHF (₣)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="serviceDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date de service (obligatoire)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Choisir la date de service</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-sm text-muted-foreground">
                        Le paiement devra être effectué avant la veille de cette date.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full gradient-primary text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Création...' : 'Créer la transaction et générer le lien'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};