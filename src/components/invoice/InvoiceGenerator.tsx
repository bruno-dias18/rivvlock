import { jsPDF } from 'jspdf';
import { Transaction } from '@/hooks/useTransactions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InvoiceData {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  service_date: string;
  created_at: string;
  updated_at: string;
  status: string;
  buyer_profile?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
    country: string;
  };
  seller_profile?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
    country: string;
  };
}

export const generateInvoicePDF = (transaction: InvoiceData): void => {
  const doc = new jsPDF();

  // Colors
  const primaryColor = '#3B82F6';
  const darkColor = '#1F2937';
  const grayColor = '#6B7280';

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('RIVVLOCK', 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Facture Escrow Sécurisée', 130, 20);

  // Invoice details
  doc.setTextColor(darkColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', 20, 50);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° Transaction: ${transaction.id.substring(0, 8).toUpperCase()}`, 20, 60);
  doc.text(`Date: ${format(new Date(transaction.created_at), 'PPP', { locale: fr })}`, 20, 67);
  doc.text(`Status: ${transaction.status.toUpperCase()}`, 20, 74);

  // Seller info
  doc.setFont('helvetica', 'bold');
  doc.text('VENDEUR:', 20, 90);
  doc.setFont('helvetica', 'normal');
  const sellerName = transaction.seller_profile?.company_name || 
    `${transaction.seller_profile?.first_name} ${transaction.seller_profile?.last_name}`;
  doc.text(sellerName || 'N/A', 20, 97);
  doc.text(`Pays: ${transaction.seller_profile?.country || 'N/A'}`, 20, 104);

  // Buyer info
  doc.setFont('helvetica', 'bold');
  doc.text('ACHETEUR:', 110, 90);
  doc.setFont('helvetica', 'normal');
  const buyerName = transaction.buyer_profile?.company_name || 
    `${transaction.buyer_profile?.first_name} ${transaction.buyer_profile?.last_name}`;
  doc.text(buyerName || 'N/A', 110, 97);
  doc.text(`Pays: ${transaction.buyer_profile?.country || 'N/A'}`, 110, 104);

  // Transaction details
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DE LA TRANSACTION:', 20, 125);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Service: ${transaction.title}`, 20, 135);
  doc.text(`Description: ${transaction.description || 'N/A'}`, 20, 142);
  doc.text(`Date de service: ${format(new Date(transaction.service_date), 'PPP', { locale: fr })}`, 20, 149);

  // Financial breakdown table
  const startY = 165;
  
  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, startY, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', 25, startY + 7);
  doc.text('MONTANT', 150, startY + 7);

  // Calculate amounts
  const totalAmount = transaction.price;
  const platformFee = totalAmount * 0.05;
  const netToSeller = totalAmount - platformFee;
  
  // Calculate VAT based on country
  const getVATRate = (country: string) => {
    const vatRates: { [key: string]: number } = {
      'FR': 0.20, 'DE': 0.19, 'IT': 0.22, 'ES': 0.21, 'BE': 0.21,
      'NL': 0.21, 'AT': 0.20, 'PT': 0.23, 'LU': 0.17, 'CH': 0.077
    };
    return vatRates[country] || 0.20;
  };

  const vatRate = getVATRate(transaction.seller_profile?.country || 'FR');
  const vatAmount = netToSeller * vatRate;
  const totalWithVAT = netToSeller + vatAmount;

  // Table rows
  const rows = [
    ['Montant brut de la transaction', `${totalAmount.toFixed(2)} ${transaction.currency}`],
    ['Frais RIVVLOCK (5%)', `-${platformFee.toFixed(2)} ${transaction.currency}`],
    ['Net au vendeur (avant TVA)', `${netToSeller.toFixed(2)} ${transaction.currency}`],
    [`TVA ${(vatRate * 100).toFixed(1)}% (${transaction.seller_profile?.country || 'FR'})`, `${vatAmount.toFixed(2)} ${transaction.currency}`],
    ['TOTAL FACTURÉ', `${totalWithVAT.toFixed(2)} ${transaction.currency}`]
  ];

  doc.setFont('helvetica', 'normal');
  let currentY = startY + 15;
  
  rows.forEach((row, index) => {
    if (index === rows.length - 1) {
      doc.setFillColor(59, 130, 246);
      doc.rect(20, currentY - 5, 170, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(darkColor);
      doc.setFont('helvetica', 'normal');
    }
    
    doc.text(row[0], 25, currentY);
    doc.text(row[1], 150, currentY);
    currentY += 10;
  });

  // Payment method
  doc.setTextColor(darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text('MÉTHODE DE PAIEMENT:', 20, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text('Stripe (Carte bancaire sécurisée)', 20, currentY + 22);

  // Legal mentions
  doc.setFontSize(8);
  doc.setTextColor(grayColor);
  doc.text('Cette facture est générée automatiquement par le système RIVVLOCK.', 20, 250);
  doc.text('Les frais de 5% couvrent les coûts de traitement Stripe et les services escrow.', 20, 257);
  doc.text('En cas de litige, les frais RIVVLOCK ne sont pas remboursables.', 20, 264);
  doc.text('Acceptation des CGU RIVVLOCK lors de la création de la transaction.', 20, 271);
  doc.text(`Document généré le ${format(new Date(), 'PPP à HH:mm', { locale: fr })}`, 20, 285);

  // Footer
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('RIVVLOCK - Plateforme Escrow Sécurisée', 20, 293);
  doc.text('www.rivvlock.com', 160, 293);

  // Download
  const fileName = `RIVVLOCK_${transaction.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};