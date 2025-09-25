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
  sellerEmail?: string;
  buyerEmail?: string;
}

// Base64 du logo RivvLock (cadenas bleu) - Version optimisée pour PDF
const RIVVLOCK_LOGO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAoACgDASIAAhEBAxEB/8QAGwABAAIDAQEAAAAAAAAAAAAAAAMEAQIGBQf/xAA0EAABAwMBBQYGAQQDAAAAAAABAAIDBBEhBRIxQVFhBhMicYGRFDKhscHR4fAjQlJi8f/EABsBAAIDAQEBAAAAAAAAAAAAAAAGAwQFAgEH/8QALBEAAgECBQIEBwAAAAAAAAAAAAECAwQFESFBIFESYcHwMVKBkbHh8UKSocL/2gAMAwEAAhEDEQA/APEREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAf/Z';

export const generateInvoicePDF = (invoiceData: InvoiceData) => {
  const doc = new jsPDF();
  
  // Configuration
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const rightX = pageWidth - margin;
  // Alignement parfait avec le bord droit du tableau
  const tableRightEdge = pageWidth - margin;
  const rightColWidth = 85; // Largeur de la colonne droite
  const rightColX = tableRightEdge - rightColWidth; // Position pour alignement parfait
  
  // Position professionnelle pour la section CLIENT
  const clientStartX = pageWidth / 2 + 20;
  const clientWidth = pageWidth / 2 - margin - 30;
  let yPosition = 20;
  
  // Couleurs
  const primaryBlue = [24, 119, 242]; // RivvLock blue
  const lightGray = [245, 245, 245];
  const darkGray = [64, 64, 64];
  
  // === EN-TÊTE SIMPLIFIÉ (selon modèle) ===
  
  // Numérotation automatique par vendeur
  const sellerUserId = invoiceData.sellerProfile?.user_id || 'UNKNOWN';
  const sequenceNumber = Math.floor(Date.now() / 1000) % 10000;
  const invoiceNumber = `FAC-${sellerUserId.slice(-4).toUpperCase()}-${sequenceNumber.toString().padStart(4, '0')}`;
  const invoiceDate = new Date(invoiceData.validatedDate).toLocaleDateString('fr-FR');
  
  // RIVVLOCK à gauche et FACTURE à droite sur la même ligne
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RIVVLOCK', margin, yPosition);
  doc.text('FACTURE', rightX, yPosition, { align: 'right' });
  
  yPosition += 8;
  
  // Sous-informations RIVVLOCK (à gauche)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Plateforme d\'escrow sécurisée', margin, yPosition);
  doc.text('www.rivvlock.com', margin, yPosition + 4);
  
  // Informations facture (à droite) - sous le titre FACTURE, alignées à droite
  doc.text(`N° ${invoiceNumber}`, rightX, yPosition, { align: 'right' });
  doc.text(`Date: ${invoiceDate}`, rightX, yPosition + 4, { align: 'right' });
  
  yPosition += 15;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 25;
  
  // === ÉMETTEUR ET CLIENT (parfaitement alignés) ===
  
  const emetteurStartY = yPosition;
  
  // Titres ÉMETTEUR et CLIENT parfaitement alignés
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('ÉMETTEUR', margin, yPosition);
  doc.text('CLIENT', clientStartX, yPosition);
  
  yPosition += 8;
  
  // Informations émetteur (colonne gauche)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.sellerName, margin, yPosition);
  
  let leftColumnY = yPosition + 4;
  doc.setFont('helvetica', 'normal');
  
  if (invoiceData.sellerProfile) {
    const profile = invoiceData.sellerProfile;
    
    if (profile.first_name || profile.last_name) {
      doc.text(`${profile.first_name || ''} ${profile.last_name || ''}`.trim(), margin, leftColumnY);
      leftColumnY += 4;
    }
    
    if (invoiceData.sellerEmail) {
      doc.text(invoiceData.sellerEmail, margin, leftColumnY);
      leftColumnY += 4;
    }
    
    if (profile.phone) {
      doc.text(`Tél: ${profile.phone}`, margin, leftColumnY);
      leftColumnY += 4;
    }
    
    if (profile.company_name) {
      doc.text(profile.company_name, margin, leftColumnY);
      leftColumnY += 4;
    }
    
    if (profile.address) {
      doc.text(profile.address, margin, leftColumnY);
      leftColumnY += 4;
    }
    
    if (profile.postal_code && profile.city) {
      doc.text(`${profile.postal_code} ${profile.city}`, margin, leftColumnY);
      leftColumnY += 4;
    }
  }
  
  // Informations client (colonne droite) - positionnée professionnellement
  const clientX = clientStartX;
  let rightColumnY = yPosition;
  
  doc.setFont('helvetica', 'bold');
  const buyerNameLines = doc.splitTextToSize(invoiceData.buyerName, clientWidth);
  doc.text(buyerNameLines, clientX, rightColumnY);
  rightColumnY += buyerNameLines.length * 4;
  
  doc.setFont('helvetica', 'normal');
  
  if (invoiceData.buyerProfile) {
    const profile = invoiceData.buyerProfile;
    
    if (profile.first_name || profile.last_name) {
      const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      const nameLines = doc.splitTextToSize(fullName, clientWidth);
      doc.text(nameLines, clientX, rightColumnY);
      rightColumnY += nameLines.length * 4;
    }
    
    if (invoiceData.buyerEmail) {
      const emailLines = doc.splitTextToSize(invoiceData.buyerEmail, clientWidth);
      doc.text(emailLines, clientX, rightColumnY);
      rightColumnY += emailLines.length * 4;
    }
    
    if (profile.phone) {
      doc.text(`Tél: ${profile.phone}`, clientX, rightColumnY);
      rightColumnY += 4;
    }
    
    if (profile.company_name) {
      const companyLines = doc.splitTextToSize(profile.company_name, clientWidth);
      doc.text(companyLines, clientX, rightColumnY);
      rightColumnY += companyLines.length * 4;
    }
    
    if (profile.address) {
      const addressLines = doc.splitTextToSize(profile.address, clientWidth);
      doc.text(addressLines, clientX, rightColumnY);
      rightColumnY += addressLines.length * 4;
    }
    
    if (profile.postal_code && profile.city) {
      doc.text(`${profile.postal_code} ${profile.city}`, clientX, rightColumnY);
      rightColumnY += 4;
    }
  }
  
  // Ajuster la position selon la colonne la plus longue
  yPosition = Math.max(leftColumnY, rightColumnY) + 15;
  
  // === TABLEAU SIMPLIFIÉ (selon modèle) ===
  
  // Calculs pour le tableau
  const amountPaid = invoiceData.amount;
  const rivvlockFee = amountPaid * 0.05;
  const amountReceived = amountPaid - rivvlockFee;
  const currency = invoiceData.currency.toUpperCase();
  
  // En-tête tableau avec bordure
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8);
  
  // En-têtes colonnes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  doc.text('Désignation', margin + 2, yPosition + 5.5);
  doc.text('Prix', margin + 100, yPosition + 5.5);
  doc.text('Qté', margin + 130, yPosition + 5.5);
  doc.text('Total HT', margin + 150, yPosition + 5.5);
  
  yPosition += 8;
  
  // Ligne de contenu
  const contentHeight = invoiceData.description ? 16 : 10;
  doc.rect(margin, yPosition, pageWidth - 2 * margin, contentHeight);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Description sur deux lignes si nécessaire
  doc.text(invoiceData.title, margin + 2, yPosition + 6);
  if (invoiceData.description) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(invoiceData.description.substring(0, 40) + '...', margin + 2, yPosition + 12);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
  }
  
  // Valeurs
  doc.text(`${amountPaid.toFixed(2)} ${currency}`, margin + 100, yPosition + 6);
  doc.text('1', margin + 135, yPosition + 6);
  doc.text(`${amountPaid.toFixed(2)} ${currency}`, margin + 150, yPosition + 6);
  
  yPosition += contentHeight + 15;
  
  // === CALCULS FINANCIERS (alignés avec le bord droit du tableau) ===
  
  const labelX = rightColX;
  const valueX = tableRightEdge; // Alignement parfait avec le bord droit du tableau
  
  // Total HT
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Total HT:', labelX, yPosition, { align: 'left' });
  doc.text(`${amountPaid.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
  
  yPosition += 8;
  
  // Frais RivvLock
  doc.text('Frais RivvLock (5%):', labelX, yPosition, { align: 'left' });
  doc.text(`${rivvlockFee.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
  
  yPosition += 8;
  
  // À payer (montant total que le client paye)
  doc.setFont('helvetica', 'bold');
  doc.text('À payer:', labelX, yPosition, { align: 'left' });
  doc.text(`${amountPaid.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
  
  yPosition += 10;
  
  // Net reçu (montant reçu par le vendeur après frais)
  doc.setFont('helvetica', 'normal');
  doc.text('Net reçu:', labelX, yPosition, { align: 'left' });
  doc.text(`${amountReceived.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
  
  yPosition += 20;
  
  // === INFORMATIONS COMPLÉMENTAIRES (simplifiées) ===
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  if (invoiceData.serviceDate) {
    doc.text(`Service réalisé le: ${new Date(invoiceData.serviceDate).toLocaleDateString('fr-FR')}`, margin, yPosition);
    yPosition += 5;
  }
  
  doc.text(`Transaction validée le: ${invoiceDate}`, margin, yPosition);
  yPosition += 15;
  
  // === PIED DE PAGE SIMPLIFIÉ ===
  
  // Contact RivvLock centré en bas
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const footerText = 'RivvLock - Plateforme d\'escrow sécurisée | contact@rivvlock.com | www.rivvlock.com';
  const footerTextWidth = doc.getTextWidth(footerText);
  doc.text(footerText, (pageWidth - footerTextWidth) / 2, footerY);
  
  // Télécharger le PDF avec numéro de facture automatique
  const fileName = `Facture-${invoiceNumber}.pdf`;
  doc.save(fileName);
};