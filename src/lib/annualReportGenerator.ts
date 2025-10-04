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
    // Fetch all validated transactions for the year with all necessary fields
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', sellerId)
      .eq('status', 'validated')
      .gte('updated_at', `${year}-01-01`)
      .lte('updated_at', `${year}-12-31`)
      .order('updated_at', { ascending: true });

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      throw new Error('Aucune transaction trouvée pour cette année');
    }

    const transactionIds = transactions.map(t => t.id);

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

    // Fetch seller profile once - use secure RPC
    const { data: sellerProfileData, error: sellerError } = await supabase.rpc('get_seller_invoice_data', {
      p_seller_id: sellerId,
      p_requesting_user_id: sellerId
    });
    const sellerProfile = Array.isArray(sellerProfileData) && sellerProfileData.length > 0 ? sellerProfileData[0] : null;

    if (sellerError || !sellerProfile) {
      throw new Error('Impossible de récupérer le profil vendeur');
    }

    // Fetch all buyer profiles at once - use secure RPCs
    const buyerIds = [...new Set(transactions.map(t => t.buyer_id).filter(Boolean))];
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
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, transactions.length);
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

        // Prepare invoice data
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
          t: t
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

    return transactions.length;
  } catch (error) {
    logger.error('Error generating invoices ZIP:', error);
    throw error;
  }
};
