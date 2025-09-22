import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  user_id: string;
  user_type: 'individual' | 'company' | 'independent';
  country: 'FR' | 'CH';
  verified: boolean;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  siret_uid?: string;
  company_address?: string;
  iban?: string;
  avs_number?: string;
  tva_rate?: number;
  vat_rate?: number;
  created_at: string;
}

interface TransactionData {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: 'EUR' | 'CHF';
  service_date: string;
  created_at: string;
  status: string;
  user_id: string;
  buyer_id?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  transaction: TransactionData;
  userProfile: UserProfile;
  userEmail: string;
  invoiceType: 'seller' | 'buyer';
}

export const generateSellerInvoice = async (
  transaction: TransactionData,
  sellerProfile: UserProfile,
  sellerEmail: string
): Promise<string> => {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor = [59, 130, 246];
  const darkColor = [31, 41, 55];
  const grayColor = [107, 114, 128];
  const successColor = [34, 197, 94];

  // Header with RIVVLOCK branding
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('🔒 RIVVLOCK', 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Facture Vendeur - Escrow Sécurisé', 20, 28);

  // Invoice details
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE VENDEUR', 20, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const invoiceNumber = `RV-${transaction.id.substring(0, 8).toUpperCase()}`;
  doc.text(`N° Facture: ${invoiceNumber}`, 20, 65);
  doc.text(`Date: ${format(new Date(), 'PPP', { locale: fr })}`, 20, 72);
  doc.text(`Transaction: ${transaction.id.substring(0, 8).toUpperCase()}`, 20, 79);

  // Seller information section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold'); 
  doc.text('INFORMATIONS VENDEUR:', 20, 95);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = 105;

  if (sellerProfile.user_type === 'company') {
    doc.text(`Raison sociale: ${sellerProfile.company_name || 'N/A'}`, 20, yPos);
    yPos += 7;
    
    const businessId = sellerProfile.country === 'FR' ? 'SIRET' : 'UID';
    doc.text(`${businessId}: ${sellerProfile.siret_uid || 'N/A'}`, 20, yPos);
    yPos += 7;
    
    const vatRate = sellerProfile.vat_rate || (sellerProfile.country === 'FR' ? 20.0 : 8.1);
    doc.text(`TVA: ${vatRate}%`, 20, yPos);
    yPos += 7;
    
    doc.text(`Adresse siège: ${sellerProfile.company_address || 'N/A'}`, 20, yPos);
    yPos += 7;
    
    doc.text(`IBAN: ${sellerProfile.iban || 'N/A'}`, 20, yPos);
    yPos += 7;
  } else {
    doc.text(`Nom: ${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`, 20, yPos);
    yPos += 7;
    
    if (sellerProfile.user_type === 'independent' && sellerProfile.country === 'CH') {
      if (sellerProfile.avs_number) {
        doc.text(`AVS: ${sellerProfile.avs_number}`, 20, yPos);
        yPos += 7;
      }
      if (sellerProfile.tva_rate) {
        doc.text(`TVA: ${sellerProfile.tva_rate}%`, 20, yPos);
        yPos += 7;
      }
    }
  }
  
  doc.text(`Email: ${sellerEmail}`, 20, yPos);
  yPos += 7;
  doc.text(`Téléphone: ${sellerProfile.phone || 'N/A'}`, 20, yPos);
  yPos += 7;
  
  if (sellerProfile.user_type !== 'company') {
    doc.text(`Adresse: ${sellerProfile.address || 'N/A'}`, 20, yPos);
    yPos += 7;
  }
  
  doc.text(`Pays: ${sellerProfile.country === 'FR' ? '🇫🇷 France' : '🇨🇭 Suisse'}`, 20, yPos);

  // Transaction details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DE LA TRANSACTION:', 20, yPos + 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  yPos += 30;
  doc.text(`Service: ${transaction.title}`, 20, yPos);
  yPos += 7;
  doc.text(`Description: ${transaction.description || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Date de service: ${format(new Date(transaction.service_date), 'PPP', { locale: fr })}`, 20, yPos);
  yPos += 7;
  doc.text(`Devise: ${transaction.currency}`, 20, yPos);

  // Financial breakdown table
  const tableStartY = yPos + 20;
  
  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, tableStartY, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', 25, tableStartY + 7);
  doc.text('MONTANT', 160, tableStartY + 7);

  // Calculate amounts
  const grossAmount = transaction.price;
  const platformFee = grossAmount * 0.05;
  const netAmount = grossAmount - platformFee;
  
  // Table rows
  const rows = [
    ['Montant brut de la transaction', `${grossAmount.toFixed(2)} ${transaction.currency}`],
    ['Frais RIVVLOCK (5%)', `-${platformFee.toFixed(2)} ${transaction.currency}`],
    ['NET À RECEVOIR', `${netAmount.toFixed(2)} ${transaction.currency}`]
  ];

  doc.setFont('helvetica', 'normal');
  let currentY = tableStartY + 15;
  
  rows.forEach((row, index) => {
    if (index === rows.length - 1) {
      doc.setFillColor(34, 197, 94);
      doc.rect(20, currentY - 5, 170, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'normal');
    }
    
    doc.text(row[0], 25, currentY);
    doc.text(row[1], 160, currentY);
    currentY += 10;
  });

  // Legal mentions
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  currentY += 20;
  doc.text('CONDITIONS:', 20, currentY);
  currentY += 7;
  doc.text('• Les fonds seront libérés après validation de la transaction par l\'acheteur', 20, currentY);
  currentY += 5;
  doc.text('• Frais RIVVLOCK de 5% prélevés automatiquement', 20, currentY);
  currentY += 5;
  doc.text('• Paiement sécurisé via Stripe', 20, currentY);
  currentY += 10;
  doc.text(`Facture générée automatiquement le ${format(new Date(), 'PPP à HH:mm', { locale: fr })}`, 20, currentY);

  // Footer
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('RIVVLOCK - Plateforme Escrow Sécurisée • www.rivvlock.com', 20, 293);

  return doc.output('datauristring');
};

export const generateBuyerInvoice = async (
  transaction: TransactionData,
  buyerProfile: UserProfile,
  buyerEmail: string
): Promise<string> => {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor = [59, 130, 246];
  const darkColor = [31, 41, 55];
  const grayColor = [107, 114, 128];
  const blueColor = [34, 197, 94];

  // Header with RIVVLOCK branding
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('🔒 RIVVLOCK', 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Reçu Acheteur - Escrow Sécurisé', 20, 28);

  // Invoice details
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REÇU ACHETEUR', 20, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const receiptNumber = `RV-B-${transaction.id.substring(0, 8).toUpperCase()}`;
  doc.text(`N° Reçu: ${receiptNumber}`, 20, 65);
  doc.text(`Date: ${format(new Date(), 'PPP', { locale: fr })}`, 20, 72);
  doc.text(`Transaction: ${transaction.id.substring(0, 8).toUpperCase()}`, 20, 79);

  // Buyer information section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS ACHETEUR:', 20, 95);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = 105;

  if (buyerProfile.user_type === 'company') {
    doc.text(`Raison sociale: ${buyerProfile.company_name || 'N/A'}`, 20, yPos);
    yPos += 7;
  } else {
    doc.text(`Nom: ${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`, 20, yPos);
    yPos += 7;
  }
  
  doc.text(`Email: ${buyerEmail}`, 20, yPos);
  yPos += 7;
  doc.text(`Téléphone: ${buyerProfile.phone || 'N/A'}`, 20, yPos);
  yPos += 7;
  
  const address = buyerProfile.user_type === 'company' ? buyerProfile.company_address : buyerProfile.address;
  doc.text(`Adresse: ${address || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Pays: ${buyerProfile.country === 'FR' ? '🇫🇷 France' : '🇨🇭 Suisse'}`, 20, yPos);

  // Transaction details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DE LA TRANSACTION:', 20, yPos + 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  yPos += 30;
  doc.text(`Service: ${transaction.title}`, 20, yPos);
  yPos += 7;
  doc.text(`Description: ${transaction.description || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Date de service: ${format(new Date(transaction.service_date), 'PPP', { locale: fr })}`, 20, yPos);
  yPos += 7;
  doc.text(`Devise: ${transaction.currency}`, 20, yPos);

  // Payment breakdown table
  const tableStartY = yPos + 20;
  
  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, tableStartY, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', 25, tableStartY + 7);
  doc.text('MONTANT', 160, tableStartY + 7);

  // Calculate amounts
  const totalPaid = transaction.price;
  const platformFee = totalPaid * 0.05;
  
  // Table rows
  const rows = [
    ['Montant du service', `${totalPaid.toFixed(2)} ${transaction.currency}`],
    ['Frais RIVVLOCK inclus (5%)', `${platformFee.toFixed(2)} ${transaction.currency}`],
    ['TOTAL PAYÉ', `${totalPaid.toFixed(2)} ${transaction.currency}`]
  ];

  doc.setFont('helvetica', 'normal');
  let currentY = tableStartY + 15;
  
  rows.forEach((row, index) => {
    if (index === rows.length - 1) {
      doc.setFillColor(34, 197, 94);
      doc.rect(20, currentY - 5, 170, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'normal');
    }
    
    doc.text(row[0], 25, currentY);
    doc.text(row[1], 160, currentY);
    currentY += 10;
  });

  // Legal mentions
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal'); 
  currentY += 20;
  doc.text('CONDITIONS DE L\'ESCROW:', 20, currentY);
  currentY += 7;
  doc.text('• Vos fonds sont sécurisés jusqu\'à validation de la transaction', 20, currentY);
  currentY += 5;
  doc.text('• Remboursement possible en cas de litige justifié', 20, currentY);
  currentY += 5;
  doc.text('• Paiement sécurisé traité par Stripe', 20, currentY);
  currentY += 10;
  doc.text(`Reçu généré automatiquement le ${format(new Date(), 'PPP à HH:mm', { locale: fr })}`, 20, currentY);

  // Footer
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('RIVVLOCK - Plateforme Escrow Sécurisée • www.rivvlock.com', 20, 293);

  return doc.output('datauristring');
};

export const generateInvoicesForTransaction = async (transactionId: string) => {
  try {
    // Fetch transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error('Transaction non trouvée');
    }

    // Get seller profile
    const { data: sellerProfile, error: sellerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', transaction.user_id)
      .single();

    // Get buyer profile if buyer exists
    let buyerProfile = null;
    if (transaction.buyer_id) {
      const { data: buyerData, error: buyerError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', transaction.buyer_id)
        .single();
      
      if (!buyerError && buyerData) {
        buyerProfile = buyerData;
      }
    }

    // Get seller email from auth
    const { data: sellerUser } = await supabase.auth.admin.getUserById(transaction.user_id);
    const sellerEmail = sellerUser?.user?.email || '';

    // Get buyer email if buyer exists
    let buyerEmail = '';
    if (transaction.buyer_id) {
      const { data: buyerUser } = await supabase.auth.admin.getUserById(transaction.buyer_id);
      buyerEmail = buyerUser?.user?.email || '';
    }

    const invoices = [];

    // Generate seller invoice
    if (sellerProfile) {
      const sellerInvoiceData = await generateSellerInvoice(
        transaction,
        sellerProfile,
        sellerEmail
      );
      
      invoices.push({
        type: 'seller',
        user_id: transaction.user_id,
        data: sellerInvoiceData,
        filename: `RIVVLOCK_Vendeur_${transaction.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      });

      console.log(`📧 [MOCK EMAIL] Facture vendeur générée pour ${sellerEmail}`);
      console.log(`📄 Transaction: ${transaction.title} - ${transaction.price} ${transaction.currency}`);
    }

    // Generate buyer invoice if buyer exists
    if (transaction.buyer_id && buyerProfile) {
      const buyerInvoiceData = await generateBuyerInvoice(
        transaction,
        buyerProfile,
        buyerEmail
      );
      
      invoices.push({
        type: 'buyer',
        user_id: transaction.buyer_id,
        data: buyerInvoiceData,
        filename: `RIVVLOCK_Acheteur_${transaction.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      });

      console.log(`📧 [MOCK EMAIL] Reçu acheteur généré pour ${buyerEmail}`);
      console.log(`📄 Transaction: ${transaction.title} - ${transaction.price} ${transaction.currency}`);
    }

    return invoices;
  } catch (error) {
    console.error('Erreur génération factures:', error);
    throw error;
  }
};

// Mobile-compatible download function
export const downloadInvoice = (dataUri: string, filename: string) => {
  try {
    // Check if we're on mobile
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    );
    
    if (isMobile) {
      // Mobile approach: Convert data URI to blob and open in new tab
      const byteCharacters = atob(dataUri.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Create blob URL and open in new tab
      const blobUrl = URL.createObjectURL(blob);
      const newWindow = window.open(blobUrl, '_blank');
      
      if (newWindow) {
        // Clean up blob URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      } else {
        // Fallback: try direct navigation
        window.location.href = blobUrl;
      }
    } else {
      // Desktop approach: Use traditional download
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error downloading invoice:', error);
    // Fallback: open data URI directly
    window.open(dataUri, '_blank');
  }
};