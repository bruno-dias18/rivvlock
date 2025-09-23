import jsPDF from 'jspdf';

interface InvoiceData {
  transactionId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  sellerName: string;
  buyerName: string;
  serviceDate?: string;
  validatedDate: string;
  sellerProfile?: any;
  buyerProfile?: any;
}

export const generateInvoicePDF = (invoiceData: InvoiceData) => {
  const doc = new jsPDF();
  
  // Configuration
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let yPosition = 30;
  
  // En-tête RivvLock
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('RIVVLOCK', margin, yPosition);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Plateforme d\'escrow sécurisée', margin, yPosition + 8);
  
  yPosition += 30;
  
  // Titre de la facture
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', margin, yPosition);
  
  yPosition += 20;
  
  // Informations de la facture
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Numéro: INV-${invoiceData.transactionId.slice(-8)}`, margin, yPosition);
  doc.text(`Date: ${new Date(invoiceData.validatedDate).toLocaleDateString('fr-FR')}`, pageWidth - 80, yPosition);
  
  yPosition += 20;
  
  // Informations vendeur et acheteur
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDEUR:', margin, yPosition);
  doc.text('ACHETEUR:', pageWidth / 2 + 10, yPosition);
  
  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.sellerName, margin, yPosition);
  doc.text(invoiceData.buyerName, pageWidth / 2 + 10, yPosition);
  
  if (invoiceData.sellerProfile?.address) {
    yPosition += 6;
    doc.text(invoiceData.sellerProfile.address, margin, yPosition);
  }
  
  if (invoiceData.buyerProfile?.address) {
    yPosition += 6;
    doc.text(invoiceData.buyerProfile.address, pageWidth / 2 + 10, yPosition);
  }
  
  yPosition += 30;
  
  // Détails de la transaction
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DE LA TRANSACTION:', margin, yPosition);
  
  yPosition += 15;
  
  // En-tête du tableau
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 2, yPosition);
  doc.text('Montant', pageWidth - 80, yPosition);
  
  yPosition += 15;
  
  // Ligne de service
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.title, margin + 2, yPosition);
  if (invoiceData.description) {
    yPosition += 5;
    doc.setFontSize(8);
    doc.text(invoiceData.description, margin + 2, yPosition);
    doc.setFontSize(9);
  }
  doc.text(`${invoiceData.amount.toFixed(2)} ${invoiceData.currency.toUpperCase()}`, pageWidth - 80, yPosition);
  
  yPosition += 15;
  
  // Calculs
  const amountPaid = invoiceData.amount; // Ce que paie l'acheteur
  const rivvlockFee = amountPaid * 0.05; // Frais déduits du vendeur
  const amountReceived = amountPaid - rivvlockFee; // Ce que reçoit le vendeur
  
  // Montant payé par l'acheteur
  doc.text('Montant payé par l\'acheteur:', pageWidth - 130, yPosition);
  doc.text(`${amountPaid.toFixed(2)} ${invoiceData.currency.toUpperCase()}`, pageWidth - 80, yPosition);
  
  yPosition += 8;
  
  // Frais RivvLock (déduits du vendeur)
  doc.text('Frais RivvLock (5%) - déduits:', pageWidth - 130, yPosition);
  doc.text(`-${rivvlockFee.toFixed(2)} ${invoiceData.currency.toUpperCase()}`, pageWidth - 80, yPosition);
  
  yPosition += 8;
  
  // Ligne de séparation
  doc.line(pageWidth - 130, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 8;
  
  // Montant net reçu par le vendeur
  doc.setFont('helvetica', 'bold');
  doc.text('Montant net reçu par le vendeur:', pageWidth - 130, yPosition);
  doc.text(`${amountReceived.toFixed(2)} ${invoiceData.currency.toUpperCase()}`, pageWidth - 80, yPosition);
  
  yPosition += 30;
  
  // Informations de service
  if (invoiceData.serviceDate) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Service réalisé le: ${new Date(invoiceData.serviceDate).toLocaleDateString('fr-FR')}`, margin, yPosition);
    yPosition += 8;
  }
  
  doc.text(`Transaction validée le: ${new Date(invoiceData.validatedDate).toLocaleDateString('fr-FR')}`, margin, yPosition);
  
  yPosition += 30;
  
  // Pied de page
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Facture générée automatiquement par RivvLock - Plateforme d\'escrow sécurisée', margin, yPosition);
  doc.text('Cette facture certifie la réalisation de la transaction via notre service d\'escrow.', margin, yPosition + 5);
  
  // Télécharger le PDF
  const fileName = `Facture-RivvLock-${invoiceData.transactionId.slice(-8)}.pdf`;
  doc.save(fileName);
};