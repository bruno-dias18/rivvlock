import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoicePDF, InvoiceData } from './pdfGenerator';
import { logger } from '@/lib/logger';

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
  
  // Calculer le taux de TVA
  const vatRate = sellerProfile.tva_rate || sellerProfile.vat_rate || 0;
  
  // Labels selon la langue
  const labels = {
    fr: {
      revenueTTC: 'CA Total TTC',
      revenueHT: 'CA Total HT',
      vat: 'TVA collectée',
      fees: 'Total frais RivvLock (5%)',
      net: 'Net reçu'
    },
    en: {
      revenueTTC: 'Total Revenue (incl. VAT)',
      revenueHT: 'Total Revenue (excl. VAT)',
      vat: 'VAT Collected',
      fees: 'Total RivvLock fees (5%)',
      net: 'Net Received'
    },
    de: {
      revenueTTC: 'Gesamtumsatz (inkl. MwSt)',
      revenueHT: 'Gesamtumsatz (exkl. MwSt)',
      vat: 'Gesammelte MwSt',
      fees: 'Gesamt RivvLock Gebühren (5%)',
      net: 'Netto erhalten'
    }
  };
  
  const currentLabels = labels[language as keyof typeof labels] || labels.fr;
  
  // Ajouter les totaux par devise avec décomposition HT/TVA/TTC
  Object.entries(currencyTotals).sort(([a], [b]) => a.localeCompare(b)).forEach(([curr, amount], index) => {
    // Ajouter un séparateur visuel entre devises (sauf pour la première)
    if (index > 0) {
      summaryData.push(['', '']); // Ligne vide
    }
    
    // Ajouter le titre de la devise
    const currencyTitle = language === 'en' ? `Currency ${curr}` : language === 'de' ? `Währung ${curr}` : `Devise ${curr}`;
    summaryData.push([currencyTitle, '']);
    
    // Le montant total est TTC
    const totalTTC = amount;
    const totalHT = vatRate > 0 ? totalTTC / (1 + vatRate / 100) : totalTTC;
    const totalVAT = totalTTC - totalHT;
    const fees = totalTTC * 0.05;
    const net = totalTTC - fees;
    
    summaryData.push(
      [currentLabels.revenueTTC, `${totalTTC.toFixed(2)} ${curr}`],
      [currentLabels.revenueHT, `${totalHT.toFixed(2)} ${curr}`],
      [currentLabels.vat, `${totalVAT.toFixed(2)} ${curr}`],
      [currentLabels.fees, `${fees.toFixed(2)} ${curr}`],
      [currentLabels.net, `${net.toFixed(2)} ${curr}`]
    );
  });
  
  summaryData.forEach(([label, value]) => {
    // Si c'est une ligne vide (séparateur)
    if (label === '' && value === '') {
      yPosition += 3;
      return;
    }
    
    // Si c'est un titre de devise (pas de ":")
    if (label.startsWith('Devise ') || label.startsWith('Currency ') || label.startsWith('Währung ')) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text(label, margin, yPosition);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      yPosition += 8;
      return;
    }
    
    // Ligne normale
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
  
  // Labels des colonnes selon la langue
  const columnLabels = {
    fr: {
      date: 'Date',
      invoice: 'Facture',
      client: 'Client',
      amountHT: 'Mnt HT',
      vat: 'TVA',
      amountTTC: 'Mnt TTC',
      fees: 'Frais',
      net: 'Net'
    },
    en: {
      date: 'Date',
      invoice: 'Invoice',
      client: 'Client',
      amountHT: 'Amt excl. VAT',
      vat: 'VAT',
      amountTTC: 'Amt incl. VAT',
      fees: 'Fees',
      net: 'Net'
    },
    de: {
      date: 'Datum',
      invoice: 'Rechnung',
      client: 'Kunde',
      amountHT: 'Betr. o. MwSt',
      vat: 'MwSt',
      amountTTC: 'Betr. m. MwSt',
      fees: 'Gebühren',
      net: 'Netto'
    }
  };
  
  const cols = columnLabels[language as keyof typeof columnLabels] || columnLabels.fr;
  
  // En-têtes avec colonnes HT/TVA/TTC
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 7, 'F');
  
  doc.text(cols.date, margin + 2, yPosition);
  doc.text(cols.invoice, margin + 24, yPosition);
  doc.text(cols.client, margin + 63, yPosition);
  doc.text(cols.amountHT, margin + 103, yPosition, { align: 'right' });
  doc.text(cols.vat, margin + 121, yPosition, { align: 'right' });
  doc.text(cols.amountTTC, margin + 142, yPosition, { align: 'right' });
  doc.text(cols.fees, margin + 160, yPosition, { align: 'right' });
  doc.text(cols.net, margin + 180, yPosition, { align: 'right' });
  
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
    
    // Calculer le montant réel après remboursement partiel
    let amountTTC = Number(transaction.price);
    const pct = Number(transaction.refund_percentage || 0);
    if ((transaction.refund_status === 'partial' || pct > 0) && pct > 0) {
      amountTTC = amountTTC * (1 - pct / 100);
    }
    
    // Décomposer TTC en HT et TVA
    const amountHT = vatRate > 0 ? amountTTC / (1 + vatRate / 100) : amountTTC;
    const vatAmount = amountTTC - amountHT;
    
    const fee = amountTTC * 0.05;
    const net = amountTTC - fee;
    const invoiceNum = invoiceMap.get(transaction.id) || '-';
    const client = transaction.buyer_display_name || '-';
    
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, 6, 'F');
    }
    
    doc.text(date, margin + 2, yPosition);
    doc.text(invoiceNum, margin + 24, yPosition);
    doc.text(client.substring(0, 18), margin + 63, yPosition);
    doc.text(amountHT.toFixed(2), margin + 103, yPosition, { align: 'right' });
    doc.text(vatAmount.toFixed(2), margin + 121, yPosition, { align: 'right' });
    doc.text(amountTTC.toFixed(2), margin + 142, yPosition, { align: 'right' });
    doc.text(fee.toFixed(2), margin + 160, yPosition, { align: 'right' });
    doc.text(net.toFixed(2), margin + 180, yPosition, { align: 'right' });
    
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
  
  const reportLabel = t?.('reports.annualReport') || 'Rapport annuel';
  const fileName = `${reportLabel}-${year}.pdf`.replace(/\s+/g, '-').toLowerCase();
  doc.save(fileName);
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
  // Fetch all validated transactions for the year
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', sellerId)
    .eq('status', 'validated')
    .neq('refund_status', 'full')
    .gte('updated_at', `${year}-01-01`)
    .lte('updated_at', `${year}-12-31`)
    .order('updated_at', { ascending: true });

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      throw new Error('Aucune transaction trouvée pour cette année');
    }

    const transactionIds = transactions.map(t => t.id);
    
    // Fetch disputes and their accepted proposals
    const { data: disputes } = await supabase
      .from('disputes')
      .select('transaction_id, resolution, dispute_proposals(refund_percentage, status, proposal_type)')
      .in('transaction_id', transactionIds);
    
    // Create map of refund percentages
    const refundMap = new Map<string, number>();
    disputes?.forEach(dispute => {
      const proposals = (dispute.dispute_proposals as any[]) || [];
      const acceptedProposal = proposals.find((p: any) => p.status === 'accepted' && (p.proposal_type === 'partial_refund' || (p.refund_percentage ?? 0) > 0));
      if (acceptedProposal?.refund_percentage) {
        refundMap.set(dispute.transaction_id, Number(acceptedProposal.refund_percentage));
        return;
      }
      // Fallback: parse percentage from resolution text
      if ((dispute as any).resolution && typeof (dispute as any).resolution === 'string') {
        const m = (dispute as any).resolution.match(/(\d{1,3})\s*%/);
        const pct = m ? parseInt(m[1], 10) : 0;
        if (pct > 0 && pct < 100) {
          refundMap.set(dispute.transaction_id, pct);
        }
      }
    });
    
    // Enrich transactions with refund_percentage
    const allTransactions = transactions.map(t => ({
      ...t,
      refund_percentage: refundMap.get(t.id) || 0
    }));

    // Fetch all invoices for these transactions
    const { data: allInvoices, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('seller_id', sellerId)
      .in('transaction_id', transactionIds)
      .order('generated_at', { ascending: false });

    if (invError) {
      logger.error('Error fetching invoices:', invError);
    }

    // Create a map of existing invoices (keeping only the most recent per transaction)
    const invoiceMap = new Map<string, string>();
    if (allInvoices && allInvoices.length > 0) {
      allInvoices.forEach(invoice => {
        if (!invoiceMap.has(invoice.transaction_id)) {
          invoiceMap.set(invoice.transaction_id, invoice.invoice_number);
        }
      });
    }

    // Fetch seller profile directly (self-access allowed by RLS)
    const { data: sellerProfile, error: sellerError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, company_name, user_type, country, address, postal_code, city, siret_uid, vat_rate, tva_rate, is_subject_to_vat, avs_number, vat_number, company_address, phone')
      .eq('user_id', sellerId)
      .single();

    if (sellerError || !sellerProfile) {
      throw new Error('Impossible de récupérer le profil vendeur');
    }

    // Fetch all buyer profiles at once - use secure RPCs
    const buyerIds = [...new Set(allTransactions.map(t => t.buyer_id).filter(Boolean))];
    let buyerProfilesMap = new Map();
    if (buyerIds.length > 0) {
      for (const buyerId of buyerIds) {
        const { data: buyerProfileData } = await supabase.rpc('get_buyer_invoice_data', {
          p_buyer_id: buyerId,
          p_requesting_user_id: sellerId
        });
        if (Array.isArray(buyerProfileData) && buyerProfileData.length > 0) {
          buyerProfilesMap.set(buyerId, buyerProfileData[0]);
        }
      }
    }

    // Create a ZIP file
    const zip = new JSZip();
    
    // Loop through transactions (not invoices)
    for (let i = 0; i < allTransactions.length; i++) {
      const transaction = allTransactions[i];
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, allTransactions.length);
      }

      try {
        let invoiceNumber: string;
        
        // Determine invoice number
        if (invoiceMap.has(transaction.id)) {
          // Use existing invoice number
          invoiceNumber = invoiceMap.get(transaction.id)!;
        } else {
          // Generate new invoice via edge function
          const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke(
            'generate-invoice-number',
            {
              body: {
                transactionId: transaction.id,
                sellerId: sellerId,
                buyerId: transaction.buyer_id,
                amount: transaction.price,
                currency: transaction.currency
              }
            }
          );

          if (invoiceError || !invoiceData?.invoiceNumber) {
            logger.error(`Error generating invoice for transaction ${transaction.id}:`, invoiceError);
            continue;
          }

          invoiceNumber = invoiceData.invoiceNumber;
        }

        const buyerProfile = transaction.buyer_id ? buyerProfilesMap.get(transaction.buyer_id) : null;

        // Prepare invoice data with refund information
        const invoiceDataForPDF: InvoiceData = {
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
          t: t,
          viewerRole: 'seller',
          refundStatus: (transaction.refund_status as 'none' | 'partial' | 'full') || 'none',
          refundPercentage: transaction.refund_percentage || 0
        };

        // Generate PDF as blob with the determined invoice number
        const pdfBlob = await generateInvoicePDF(invoiceDataForPDF, true, invoiceNumber);

        if (pdfBlob) {
          // Add PDF to ZIP
          zip.file(`${invoiceNumber}.pdf`, pdfBlob);
        }
      } catch (error) {
        logger.error(`Error generating PDF for transaction ${transaction.id}:`, error);
        continue;
      }
    }

    // Generate the ZIP file
    const content = await zip.generateAsync({ type: 'blob' });
    
    // Download the ZIP
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    const invoicesLabel = t?.('common.invoices') || 'factures';
    link.download = `${invoicesLabel}-${year}.zip`.replace(/\s+/g, '-').toLowerCase();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return allTransactions.length;
  } catch (error) {
    logger.error('Error generating invoices ZIP:', error);
    throw error;
  }
};
