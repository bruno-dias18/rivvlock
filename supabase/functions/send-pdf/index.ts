import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { jsPDF } from "npm:jspdf@3.0.3";
import autoTable from "npm:jspdf-autotable@5.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

function uint8ToBase64(uint8: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function buildCompetitorPDF(): ArrayBuffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const textPrimary = "#1A1F2C";
  const textSecondary = "#6E59A5";

  // Page 1
  doc.setFontSize(28);
  doc.setTextColor(textPrimary);
  doc.setFont("helvetica", "bold");
  doc.text("RivvLock - Analyse Concurrentielle 2025", pageWidth / 2, margin + 10, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(textSecondary);
  doc.setFont("helvetica", "normal");
  doc.text("Marchés Suisse, France, Allemagne", pageWidth / 2, margin + 18, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(155, 135, 243);
  doc.roundedRect(margin, margin + 25, pageWidth - 2 * margin, 25, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.text("15+ Concurrents Analysés", margin + 10, margin + 33);
  doc.text("3 Marchés (CH, FR, DE)", margin + 10, margin + 40);
  doc.text("5% TTC (Stripe inclus)", pageWidth / 2, margin + 33);
  doc.text("Abonnement: Admin + Bilan", pageWidth / 2, margin + 40);
  doc.text("Swiss Compliance (nLPD)", pageWidth - margin - 60, margin + 33);
  doc.text("Setup No-code en 5 min", pageWidth - margin - 60, margin + 40);

  doc.setFontSize(11);
  doc.setTextColor(textPrimary);
  doc.setFont("helvetica", "bold");
  doc.text("Positionnement Unique de RivvLock:", margin, margin + 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = [
    "✅ Plus simple que Mangopay/Lemonway (pas besoin de dev)",
    "✅ Moins cher qu'Upwork/Fiverr (5% vs 25%)",
    "✅ Plus accessible qu'Escrow.com (setup en 5 min vs KYC complexe)",
    "✅ Swiss compliance + Modern UX",
  ];
  let y = margin + 65;
  lines.forEach((l) => { doc.text(l, margin + 5, y); y += 6; });

  // Page 2: Tableau
  doc.addPage("a4", "landscape");
  doc.setFontSize(18);
  doc.setTextColor(textPrimary);
  doc.setFont("helvetica", "bold");
  doc.text("Tableau Comparatif Détaillé", pageWidth / 2, margin, { align: "center" });

  const competitors = [
    ["RivvLock", "🇨🇭 CH/EU", "Escrow Platform", "5% TTC (Stripe inclus)", "Abonnement: Admin + Facturation + Bilan annuel", "✅ No-code, 5 min", "Services, Freelance, E-commerce", "Swiss Compliance (nLPD)", "Escrow, Disputes, Chat, Factures, Support"],
    ["Escrow.com", "🌍 Global", "Pure Escrow", "0.89% - 3.25%", "+ min $25", "⚠️ KYC complexe", "Domaines, Véhicules, High-value", "US Licensed", "Escrow uniquement"],
    ["Stripe Connect", "🌍 Global", "PSP/Infra", "2.9% + 0.30€", "Par transaction", "❌ Intégration dev", "Marketplaces techniques", "PCI-DSS L1", "API, Webhooks (escrow à coder)"],
    ["Mangopay", "🇫🇷 FR/EU", "PSP Escrow", "1.8% + 0.18€", "+ setup 2500€", "❌ Intégration dev", "Marketplaces, Plateformes", "EMI FR", "E-wallets, KYC, API"],
    ["Lemonway", "🇫🇷 FR/EU", "PSP Escrow", "1.2% + 0.18€", "+ setup variable", "❌ Intégration dev", "Crowdfunding, Marketplaces", "EMI FR", "E-wallets, KYC, Compliance"],
    ["Tripartie", "🇫🇷 FR", "Escrow B2C", "2.5% - 5%", "Selon volume", "⚠️ API/Plugin", "E-commerce, Leboncoin", "Partenaire bancaire FR", "Escrow, Disputes, Assurance colis"],
    ["OPP", "🇩🇪 DE", "Marketplace Escrow", "1.9% + 0.35€", "Par transaction", "❌ API complète", "Marketplaces allemandes", "BaFin DE", "Escrow, Identity, Compliance"],
  ];

  autoTable(doc, {
    head: [["Concurrent", "Zone", "Type", "Frais (%)", "Frais Fixes", "Setup Technique", "Cible Clientèle", "Régulation", "Services Inclus"]],
    body: competitors,
    startY: margin + 8,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [155, 135, 243], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    didParseCell: (data: any) => {
      if (data.row.index === 0 && data.section === "body") {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [21, 128, 61];
      }
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`RivvLock - Analyse Concurrentielle 2025 | Page ${i}/${totalPages}` as string, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text('Généré le ' + new Date().toLocaleDateString('fr-FR'), pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to } = await req.json().catch(() => ({ to: undefined }));
    const recipient = to || 'contact@rivvlock.com';

    const arrayBuffer = buildCompetitorPDF();
    const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

    const res = await resend.emails.send({
      from: 'RivvLock <onboarding@resend.dev>',
      to: [recipient],
      subject: 'RivvLock - Analyse Concurrentielle 2025 (PDF)',
      html: `<p>Bonjour,<br/>Veuillez trouver ci-joint le PDF de l'analyse concurrentielle RivvLock 2025.</p>`,
      attachments: [
        {
          filename: 'RivvLock_Analyse_Concurrentielle_2025.pdf',
          content: base64,
          contentType: 'application/pdf',
        },
      ],
    });

    return new Response(JSON.stringify(res), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('send-pdf error', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});