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

// Base64 du logo RivvLock (version réduite pour la facture)
const RIVVLOCK_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const generateInvoicePDF = (invoiceData: InvoiceData) => {
  const doc = new jsPDF();
  
  // Configuration
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let yPosition = 25;
  
  // Couleurs
  const primaryBlue = [24, 119, 242]; // RivvLock blue
  const lightGray = [245, 245, 245];
  const darkGray = [64, 64, 64];
  
  // === EN-TÊTE PROFESSIONNEL ===
  
  // Logo RivvLock (petit, à gauche)
  try {
    doc.addImage(RIVVLOCK_LOGO_BASE64, 'PNG', margin, yPosition - 5, 15, 15);
  } catch (error) {
    // Fallback si l'image ne charge pas
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('RIVVLOCK', margin, yPosition + 5);
  }
  
  // Informations RivvLock (à côté du logo)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('RIVVLOCK', margin + 20, yPosition + 2);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('Plateforme d\'escrow sécurisée', margin + 20, yPosition + 8);
  doc.text('www.rivvlock.com', margin + 20, yPosition + 12);
  
  // Titre FACTURE (à droite)
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('FACTURE', pageWidth - 60, yPosition + 5);
  
  yPosition += 25;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 15;
  
  // === INFORMATIONS FACTURE ===
  
  const invoiceNumber = `INV-${invoiceData.transactionId.slice(-8)}`;
  const invoiceDate = new Date(invoiceData.validatedDate).toLocaleDateString('fr-FR');
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'); // +30 jours
  
  // Informations à droite
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  const infoStartX = pageWidth - 80;
  doc.text('N° Facture:', infoStartX - 30, yPosition);
  doc.text('Date:', infoStartX - 30, yPosition + 6);
  doc.text('Échéance:', infoStartX - 30, yPosition + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceNumber, infoStartX, yPosition);
  doc.text(invoiceDate, infoStartX, yPosition + 6);
  doc.text(dueDate, infoStartX, yPosition + 12);
  
  yPosition += 25;
  
  // === ÉMETTEUR ET CLIENT (Two columns) ===
  
  // Émetteur (RivvLock)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('ÉMETTEUR', margin, yPosition);
  
  // Client 
  doc.text('CLIENT', pageWidth / 2 + 10, yPosition);
  
  yPosition += 8;
  
  // Informations émetteur
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('RivvLock SAS', margin, yPosition);
  
  yPosition += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Plateforme d\'escrow sécurisée', margin, yPosition);
  doc.text('Paris, France', margin, yPosition + 5);
  doc.text('contact@rivvlock.com', margin, yPosition + 10);
  
  // Informations client (vendeur/acheteur selon contexte)
  const clientY = yPosition - 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`${invoiceData.sellerName}`, pageWidth / 2 + 10, clientY);
  
  doc.setFont('helvetica', 'normal');
  if (invoiceData.sellerProfile?.address) {
    doc.text(invoiceData.sellerProfile.address, pageWidth / 2 + 10, clientY + 5);
  }
  doc.text(`Acheteur: ${invoiceData.buyerName}`, pageWidth / 2 + 10, clientY + 10);
  
  yPosition += 35;
  
  // === TABLEAU PROFESSIONNEL ===
  
  // En-tête du tableau
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F');
  
  // Bordure du tableau
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 12);
  
  // En-têtes de colonnes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  const colX1 = margin + 5; // Description
  const colX2 = margin + 80; // Prix unitaire
  const colX3 = margin + 105; // Quantité
  const colX4 = margin + 125; // Total HT
  const colX5 = margin + 145; // Frais Platform
  const colX6 = margin + 165; // Net Vendeur
  
  doc.text('Description', colX1, yPosition + 8);
  doc.text('Prix Unit.', colX2, yPosition + 8);
  doc.text('Qté', colX3, yPosition + 8);
  doc.text('Total HT', colX4, yPosition + 8);
  doc.text('Frais (5%)', colX5, yPosition + 8);
  doc.text('Net Vendeur', colX6, yPosition + 8);
  
  yPosition += 12;
  
  // Ligne de service
  const rowHeight = invoiceData.description ? 20 : 12;
  doc.rect(margin, yPosition, pageWidth - 2 * margin, rowHeight);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Description
  doc.text(invoiceData.title, colX1, yPosition + 8);
  if (invoiceData.description) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(invoiceData.description.substring(0, 30) + '...', colX1, yPosition + 14);
    doc.setFontSize(9);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  }
  
  // Calculs
  const amountPaid = invoiceData.amount;
  const rivvlockFee = amountPaid * 0.05;
  const amountReceived = amountPaid - rivvlockFee;
  const currency = invoiceData.currency.toUpperCase();
  
  // Valeurs dans le tableau
  doc.text(`${amountPaid.toFixed(2)}`, colX2, yPosition + 8);
  doc.text('1', colX3, yPosition + 8);
  doc.text(`${amountPaid.toFixed(2)}`, colX4, yPosition + 8);
  doc.text(`-${rivvlockFee.toFixed(2)}`, colX5, yPosition + 8);
  doc.text(`${amountReceived.toFixed(2)}`, colX6, yPosition + 8);
  
  yPosition += rowHeight + 20;
  
  // === SECTION CALCULS FINANCIERS ===
  
  const calcStartX = pageWidth - 100;
  
  // Sous-total
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant payé par l\'acheteur:', calcStartX - 60, yPosition);
  doc.text(`${amountPaid.toFixed(2)} ${currency}`, calcStartX, yPosition);
  
  yPosition += 8;
  
  // Frais plateforme
  doc.setTextColor(200, 50, 50); // Rouge pour les frais
  doc.text('Frais RivvLock (5%):', calcStartX - 60, yPosition);
  doc.text(`-${rivvlockFee.toFixed(2)} ${currency}`, calcStartX, yPosition);
  
  yPosition += 8;
  
  // Ligne de séparation
  doc.setDrawColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setLineWidth(1);
  doc.line(calcStartX - 60, yPosition, calcStartX + 30, yPosition);
  
  yPosition += 8;
  
  // Montant net
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('NET À RECEVOIR:', calcStartX - 60, yPosition);
  doc.text(`${amountReceived.toFixed(2)} ${currency}`, calcStartX, yPosition);
  
  yPosition += 30;
  
  // === INFORMATIONS COMPLÉMENTAIRES ===
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  if (invoiceData.serviceDate) {
    doc.text(`Service réalisé le: ${new Date(invoiceData.serviceDate).toLocaleDateString('fr-FR')}`, margin, yPosition);
    yPosition += 6;
  }
  
  doc.text(`Transaction validée le: ${invoiceDate}`, margin, yPosition);
  doc.text(`ID Transaction: ${invoiceData.transactionId}`, margin, yPosition + 6);
  
  yPosition += 20;
  
  // === PIED DE PAGE PROFESSIONNEL ===
  
  // Cadre d'informations légales
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 25, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 25);
  
  yPosition += 8;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('INFORMATIONS LÉGALES', margin + 5, yPosition);
  
  yPosition += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('• Cette facture certifie la réalisation de la transaction via notre service d\'escrow sécurisé.', margin + 5, yPosition);
  doc.text('• Les frais RivvLock (5%) sont déduits du montant reçu par le vendeur.', margin + 5, yPosition + 4);
  doc.text('• La transaction a été validée par l\'acheteur conformément aux conditions d\'utilisation.', margin + 5, yPosition + 8);
  
  // Numéro de page et date de génération (bas de page)
  const footerY = pageHeight - 15;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(`Page 1/1 - Générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, margin, footerY);
  doc.text('RivvLock - Plateforme d\'escrow sécurisée | contact@rivvlock.com', pageWidth - 100, footerY);
  
  // Télécharger le PDF
  const fileName = `Facture-RivvLock-${invoiceData.transactionId.slice(-8)}.pdf`;
  doc.save(fileName);
};