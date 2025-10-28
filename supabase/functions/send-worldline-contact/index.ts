import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorldlineContactRequest {
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { senderEmail, senderName, recipientEmail }: WorldlineContactRequest = await req.json();

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Demande d'information - Solution Embedded Payments pour Marketplace B2B</h2>
        
        <p>Bonjour,</p>
        
        <p><strong>Contexte :</strong><br/>
        Nous développons <strong>RivvLock</strong>, la <strong>première plateforme escrow B2B dédiée aux services en Suisse</strong>. Nous sommes actuellement <strong>finalistes dans les programmes Fongit et Genilem</strong> (processus de sélection en cours).</p>
        
        <p><strong>Besoin :</strong><br/>
        Nous recherchons une solution de paiement avec <strong>escrow natif</strong> pour notre marketplace, et votre récente offre <strong>Worldline + OPP Embedded Payments</strong> (annoncée en octobre 2024) a retenu notre attention, notamment la fonctionnalité <strong>"advanced escrow"</strong> mentionnée dans votre communiqué de presse.</p>
        
        <p><strong>Questions critiques :</strong></p>
        <ol>
          <li><strong>Escrow et CHF :</strong> Votre solution supporte-t-elle l'<strong>authorization hold</strong> (capture différée) avec une période de rétention des fonds de <strong>5 à 30 jours</strong> en <strong>francs suisses (CHF)</strong> ?</li>
          <li><strong>Méthodes de paiement CH :</strong> Supportez-vous <strong>TWINT</strong>, <strong>cartes (Visa/Mastercard)</strong>, et <strong>virements bancaires suisses</strong> ?</li>
          <li><strong>Split payments :</strong> Pouvez-vous gérer la répartition automatique entre vendeur et plateforme après validation manuelle de la transaction ?</li>
          <li><strong>Pricing :</strong> Quel est votre <strong>modèle tarifaire</strong> pour une marketplace B2B en démarrage (volume initial faible mais croissance prévue) ?</li>
          <li><strong>Onboarding vendeurs :</strong> Quelle est votre solution pour le <strong>KYC/onboarding</strong> des vendeurs suisses ?</li>
          <li><strong>Timeline :</strong> Quel est le <strong>délai d'intégration</strong> estimé pour une solution MVP ?</li>
        </ol>
        
        <p><strong>Contexte technique :</strong><br/>
        Stack : React + Supabase + Edge Functions<br/>
        Besoin : API REST ou SDK JavaScript/TypeScript</p>
        
        <p>Seriez-vous disponible pour un <strong>échange téléphonique ou visio</strong> afin de discuter de notre cas d'usage en détail ?</p>
        
        <p>Dans l'attente de votre retour,<br/>
        Cordialement,</p>
        
        <p><strong>${senderName}</strong><br/>
        Co-fondateur, RivvLock<br/>
        ${senderEmail}</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>
        
        <p style="font-size: 12px; color: #666;">
          <strong>RivvLock</strong> - Première plateforme escrow B2B pour services en Suisse<br/>
          Finaliste Fongit & Genilem
        </p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "RivvLock <onboarding@resend.dev>",
      to: [recipientEmail],
      replyTo: senderEmail,
      subject: "RivvLock - Demande d'information Worldline Embedded Payments + Escrow",
      html: emailHtml,
    });

    console.log("Email sent to Worldline:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending Worldline contact email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
