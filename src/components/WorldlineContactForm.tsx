import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Send } from "lucide-react";

export function WorldlineContactForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    senderName: "",
    senderEmail: "",
    recipientEmail: "sales@worldline.com", // Email Worldline par défaut
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-worldline-contact", {
        body: formData,
      });

      if (error) throw error;

      toast.success("Email envoyé à Worldline avec succès !");

      // Reset form
      setFormData({
        senderName: "",
        senderEmail: "",
        recipientEmail: "sales@worldline.com",
      });
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Impossible d'envoyer l'email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-card rounded-lg border">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Contacter Worldline</h2>
      </div>

      <div className="mb-6 p-4 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">
          <strong>Solution ciblée :</strong> Worldline + OPP Embedded Payments avec "advanced escrow"
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          <strong>Questions clés :</strong> Escrow CHF 5-30j, TWINT, split payments, pricing
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senderName">Votre nom</Label>
          <Input
            id="senderName"
            placeholder="Bruno Dias"
            value={formData.senderName}
            onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="senderEmail">Votre email</Label>
          <Input
            id="senderEmail"
            type="email"
            placeholder="bruno@rivvlock.com"
            value={formData.senderEmail}
            onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipientEmail">Email Worldline</Label>
          <Input
            id="recipientEmail"
            type="email"
            placeholder="sales@worldline.com"
            value={formData.recipientEmail}
            onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
            required
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            "Envoi en cours..."
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Envoyer la demande
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 p-4 bg-muted/50 rounded-md">
        <p className="text-xs text-muted-foreground">
          <strong>Note :</strong> L'email inclut automatiquement votre pitch RivvLock (finaliste Fongit/Genilem, 
          première app escrow B2B services) et toutes les questions critiques sur l'escrow CHF.
        </p>
      </div>
    </div>
  );
}
