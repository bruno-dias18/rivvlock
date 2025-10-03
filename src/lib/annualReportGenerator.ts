import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoicePDF, InvoiceData } from './pdfGenerator';

export interface AnnualReportData {
  year: number;
  transactions: any[];
  invoices: any[];
  currencyTotals: Record<string, number>;
  currency: string;
  sellerProfile: any;
  sellerEmail: string;
  language?: string;
  t?: any;
}

export const generateAnnualReportPDF = async (reportData: AnnualReportData) => {
  const { year, transactions, invoices, currencyTotals, currency, sellerProfile, sellerEmail, language = 'fr', t } = reportData;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  let yPosition = 20;
  
  const primaryBlue: [number, number, number] = [24, 119, 242];
  
  // === PAGE DE GARDE ===
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  const title = t?.('reports.annualReport') || 'RAPPORT ANNUEL';
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 15;
  
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(year.toString(), pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 30;
  
  // Informations vendeur
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t?.('reports.seller') || 'VENDEUR', margin, yPosition);
  
  yPosition += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Affichage adapté selon le type d'utilisateur (identique aux factures)
  if (sellerProfile.user_type === 'company') {
    // Pour les entreprises
    if (sellerProfile.company_name) {
      doc.text(sellerProfile.company_name, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.siret_uid) {
      const siretLabel = sellerProfile.country === 'CH' ? 'UID' : 'SIRET';
      doc.text(`${siretLabel}: ${sellerProfile.siret_uid}`, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.vat_number) {
      doc.text(`${t?.('invoice.vatNumber') || 'N° TVA'}: ${sellerProfile.vat_number}`, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerEmail) {
      doc.text(sellerEmail, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.phone) {
      const phoneLabel = language === 'de' ? 'Tel' : language === 'en' ? 'Tel' : 'Tél';
      doc.text(`${phoneLabel}: ${sellerProfile.phone}`, margin, yPosition);
      yPosition += 5;
    }
    
    // Utiliser l'adresse d'entreprise pour les sociétés
    if (sellerProfile.company_address) {
      doc.text(sellerProfile.company_address, margin, yPosition);
      yPosition += 5;
    } else if (sellerProfile.address) {
      doc.text(sellerProfile.address, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.postal_code && sellerProfile.city) {
      doc.text(`${sellerProfile.postal_code} ${sellerProfile.city}`, margin, yPosition);
      yPosition += 5;
    }
  } else {
    // Pour les particuliers et indépendants
    if (sellerProfile.first_name || sellerProfile.last_name) {
      doc.text(`${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim(), margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerEmail) {
      doc.text(sellerEmail, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.phone) {
      const phoneLabel = language === 'de' ? 'Tel' : language === 'en' ? 'Tel' : 'Tél';
      doc.text(`${phoneLabel}: ${sellerProfile.phone}`, margin, yPosition);
      yPosition += 5;
    }
    
    // Pour les indépendants, ajouter le numéro AVS si disponible
    if (sellerProfile.user_type === 'independent' && sellerProfile.avs_number) {
      doc.text(`${t?.('invoice.avsNumber') || 'N° AVS'}: ${sellerProfile.avs_number}`, margin, yPosition);
      yPosition += 5;
    }
    
    // Afficher le statut d'assujettissement TVA pour les indépendants
    if (sellerProfile.user_type === 'independent' && sellerProfile.is_subject_to_vat) {
      doc.text(`${t?.('invoice.vatSubject') || 'Assujetti TVA'}`, margin, yPosition);
      yPosition += 5;
      
      if (sellerProfile.tva_rate) {
        doc.text(`${t?.('invoice.vatRate') || 'Taux TVA'}: ${sellerProfile.tva_rate}%`, margin, yPosition);
        yPosition += 5;
      }
    }
    
    if (sellerProfile.company_name) {
      doc.text(sellerProfile.company_name, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.address) {
      doc.text(sellerProfile.address, margin, yPosition);
      yPosition += 5;
    }
    
    if (sellerProfile.postal_code && sellerProfile.city) {
      doc.text(`${sellerProfile.postal_code} ${sellerProfile.city}`, margin, yPosition);
      yPosition += 5;
    }
  }
  
  yPosition += 20;
  
  // === RÉCAPITULATIF ===
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text(t?.('reports.summary') || 'RÉCAPITULATIF', margin, yPosition);
  
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const transactionCount = transactions.length;
  
  const summaryData = [
    [t?.('reports.period') || 'Période', `${year}`],
    [t?.('reports.transactionCount') || 'Nombre de transactions', transactionCount.toString()]
  ];
  
  // Ajouter les totaux par devise
  Object.entries(currencyTotals).sort(([a], [b]) => a.localeCompare(b)).forEach(([curr, amount]) => {
    const fees = amount * 0.05;
    const net = amount - fees;
    summaryData.push(
      [t?.('reports.totalRevenue') || 'Chiffre d\'affaires total', `${amount.toFixed(2)} ${curr}`],
      [t?.('reports.totalFees') || 'Total frais RivvLock (5%)', `${fees.toFixed(2)} ${curr}`],
      [t?.('reports.netReceived') || 'Net reçu', `${net.toFixed(2)} ${curr}`]
    );
  });
  
  summaryData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 80, yPosition);
    yPosition += 6;
  });
  
  yPosition += 15;
  
  // === TABLEAU DÉTAILLÉ ===
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text(t?.('reports.detailedTransactions') || 'DÉTAIL DES TRANSACTIONS', margin, yPosition);
  
  yPosition += 10;
  
  // En-têtes
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 7, 'F');
  
  doc.text(t?.('reports.date') || 'Date', margin + 2, yPosition);
  doc.text(t?.('reports.invoice') || 'Facture', margin + 30, yPosition);
  doc.text(t?.('reports.client') || 'Client', margin + 65, yPosition);
  doc.text(t?.('reports.amount') || 'Montant', margin + 120, yPosition);
  doc.text(t?.('reports.fees') || 'Frais', margin + 145, yPosition);
  doc.text(t?.('reports.net') || 'Net', margin + 165, yPosition);
  
  yPosition += 5;
  
  const invoiceMap = new Map(invoices.map(inv => [inv.transaction_id, inv.invoice_number]));
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  transactions.forEach((transaction, index) => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    
    const date = new Date(transaction.updated_at).toLocaleDateString(
      language === 'de' ? 'de-DE' : language === 'en' ? 'en-US' : 'fr-FR',
      { year: 'numeric', month: '2-digit', day: '2-digit' }
    );
    
    const amount = Number(transaction.price);
    const fee = amount * 0.05;
    const net = amount - fee;
    const invoiceNum = invoiceMap.get(transaction.id) || '-';
    const client = transaction.buyer_display_name || '-';
    
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, 6, 'F');
    }
    
    doc.text(date, margin + 2, yPosition);
    doc.text(invoiceNum.substring(0, 15), margin + 30, yPosition);
    doc.text(client.substring(0, 20), margin + 65, yPosition);
    doc.text(`${amount.toFixed(2)}`, margin + 120, yPosition);
    doc.text(`${fee.toFixed(2)}`, margin + 145, yPosition);
    doc.text(`${net.toFixed(2)}`, margin + 165, yPosition);
    
    yPosition += 6;
  });
  
  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const footerText = `RivvLock - ${t?.('invoice.secureEscrowPlatform') || 'Plateforme d\'escrow sécurisée'} | contact@rivvlock.com | www.rivvlock.com`;
  const footerTextWidth = doc.getTextWidth(footerText);
  doc.text(footerText, (pageWidth - footerTextWidth) / 2, footerY);
  
  doc.save(`rapport-annuel-${year}.pdf`);
};

// Function to download all invoices for a year as a ZIP file
export const downloadAllInvoicesAsZip = async (
  year: number,
  sellerId: string,
  language: string,
  t: any,
  onProgress?: (current: number, total: number) => void
) => {
  try {
    // Fetch all invoices with transaction IDs for the year
    const { data: allInvoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('generated_at', `${year}-01-01`)
      .lte('generated_at', `${year}-12-31`)
      .order('generated_at', { ascending: true });

    if (error) throw error;
    if (!allInvoices || allInvoices.length === 0) {
      throw new Error('Aucune facture trouvée pour cette année');
    }

    // Keep only the most recent invoice per transaction (to avoid duplicates)
    const invoiceMap = new Map();
    allInvoices.forEach(invoice => {
      const existing = invoiceMap.get(invoice.transaction_id);
      if (!existing || new Date(invoice.generated_at) > new Date(existing.generated_at)) {
        invoiceMap.set(invoice.transaction_id, invoice);
      }
    });
    const invoices = Array.from(invoiceMap.values());

    // Create a ZIP file
    const zip = new JSZip();
    
    // For each invoice, generate a real PDF
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, invoices.length);
      }

      try {
        // Fetch transaction with buyer profile
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', invoice.transaction_id)
          .single();

        if (txError || !transaction) {
          console.error(`Error fetching transaction ${invoice.transaction_id}:`, txError);
          continue;
        }

        // Fetch seller profile
        const { data: sellerProfile, error: sellerError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', sellerId)
          .single();

        if (sellerError || !sellerProfile) {
          console.error(`Error fetching seller profile:`, sellerError);
          continue;
        }

        // Fetch buyer profile if exists
        let buyerProfile = null;
        if (transaction.buyer_id) {
          const { data: buyerData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', transaction.buyer_id)
            .single();
          buyerProfile = buyerData;
        }

        // Prepare invoice data (same structure as individual invoice)
        const invoiceData: InvoiceData = {
          transactionId: transaction.id,
          title: transaction.title,
          description: transaction.description,
          amount: transaction.price,
          currency: transaction.currency,
          sellerName: transaction.seller_display_name,
          buyerName: transaction.buyer_display_name,
          serviceDate: transaction.service_date,
          validatedDate: transaction.funds_released_at || transaction.updated_at,
          sellerProfile: sellerProfile,
          buyerProfile: buyerProfile,
          sellerEmail: '',
          buyerEmail: '',
          language: language,
          t: t
        };

        // Generate PDF as blob using EXISTING invoice number
        const pdfBlob = await generateInvoicePDF(invoiceData, true, invoice.invoice_number);

        if (pdfBlob) {
          // Add real PDF to ZIP
          zip.file(`${invoice.invoice_number}.pdf`, pdfBlob);
        }
      } catch (error) {
        console.error(`Error generating PDF for invoice ${invoice.invoice_number}:`, error);
        // Continue with next invoice even if this one fails
        continue;
      }
    }

    // Generate the ZIP file
    const content = await zip.generateAsync({ type: 'blob' });
    
    // Download the ZIP
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `factures-${year}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return invoices.length;
  } catch (error) {
    console.error('Error generating invoices ZIP:', error);
    throw error;
  }
};
