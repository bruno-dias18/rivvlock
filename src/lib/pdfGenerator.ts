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
  let yPosition = 20;
  
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
  
  // Numérotation automatique par vendeur
  const sellerUserId = invoiceData.sellerProfile?.user_id || 'UNKNOWN';
  const sequenceNumber = Math.floor(Date.now() / 1000) % 10000; // Séquence basée sur timestamp
  const invoiceNumber = `FAC-${sellerUserId.slice(-4).toUpperCase()}-${sequenceNumber.toString().padStart(4, '0')}`;
  const invoiceDate = new Date(invoiceData.validatedDate).toLocaleDateString('fr-FR');
  
  // Informations facture sous le titre FACTURE (plus petites)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text(`N° ${invoiceNumber}`, pageWidth - 60, yPosition + 12);
  doc.text(`Date: ${invoiceDate}`, pageWidth - 60, yPosition + 18);
  
  yPosition += 25;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 25;
  
  // === ÉMETTEUR ET CLIENT (Two columns) ===
  
  // Émetteur (Vendeur)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('ÉMETTEUR', margin, yPosition);
  
  // Client (Acheteur)
  doc.text('CLIENT', pageWidth - 60, yPosition);
  
  yPosition += 8;
  
  // Informations émetteur (Vendeur)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text(invoiceData.sellerName, margin, yPosition);
  
  yPosition += 5;
  doc.setFont('helvetica', 'normal');
  
  // Informations du profil vendeur
  let sellerStartY = yPosition;
  if (invoiceData.sellerProfile) {
    const profile = invoiceData.sellerProfile;
    
    // Nom/prénom
    if (profile.first_name || profile.last_name) {
      doc.text(`${profile.first_name || ''} ${profile.last_name || ''}`.trim(), margin, yPosition);
      yPosition += 4;
    }
    
    // Email réel du vendeur
    if (invoiceData.sellerEmail) {
      doc.text(`Email: ${invoiceData.sellerEmail}`, margin, yPosition);
      yPosition += 4;
    }
    
    // Téléphone
    if (profile.phone) {
      doc.text(`Tél: ${profile.phone}`, margin, yPosition);
      yPosition += 4;
    }
    
    // Société si applicable
    if (profile.company_name) {
      doc.text(profile.company_name, margin, yPosition);
      yPosition += 4;
    }
    
    // Adresse complète
    if (profile.address) {
      doc.text(profile.address, margin, yPosition);
      yPosition += 4;
    }
    
    if (profile.postal_code && profile.city) {
      doc.text(`${profile.postal_code} ${profile.city}`, margin, yPosition);
      yPosition += 4;
    }
    
    // Numéro AVS pour la Suisse
    if (profile.avs_number) {
      doc.text(`AVS: ${profile.avs_number}`, margin, yPosition);
      yPosition += 4;
    }
    
    // SIRET/UID
    if (profile.siret_uid) {
      doc.text(`SIRET/UID: ${profile.siret_uid}`, margin, yPosition);
      yPosition += 4;
    }
  }
  
  // Informations client (Acheteur) - aligné sous le titre CLIENT
  const clientX = pageWidth - 60;
  let buyerY = yPosition;
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.buyerName, clientX, buyerY);
  
  doc.setFont('helvetica', 'normal');
  buyerY += 5;
  
  if (invoiceData.buyerProfile) {
    const profile = invoiceData.buyerProfile;
    
    // Nom/prénom complet
    if (profile.first_name || profile.last_name) {
      doc.text(`${profile.first_name || ''} ${profile.last_name || ''}`.trim(), clientX, buyerY);
      buyerY += 4;
    }
    
    // Email réel du client
    if (invoiceData.buyerEmail) {
      doc.text(`Email: ${invoiceData.buyerEmail}`, clientX, buyerY);
      buyerY += 4;
    }
    
    // Téléphone
    if (profile.phone) {
      doc.text(`Tél: ${profile.phone}`, clientX, buyerY);
      buyerY += 4;
    }
    
    // Société si applicable
    if (profile.company_name) {
      doc.text(profile.company_name, clientX, buyerY);
      buyerY += 4;
    }
    
    // Adresse complète
    if (profile.address) {
      doc.text(profile.address, clientX, buyerY);
      buyerY += 4;
    }
    
    if (profile.postal_code && profile.city) {
      doc.text(`${profile.postal_code} ${profile.city}`, clientX, buyerY);
      buyerY += 4;
    }
    
    // Pays
    if (profile.country) {
      doc.text(`Pays: ${profile.country}`, clientX, buyerY);
      buyerY += 4;
    }
  }
  
  // Ajuster yPosition pour prendre en compte la section la plus longue
  yPosition = Math.max(yPosition, buyerY);
  
  yPosition += 10;
  
  // === TABLEAU PROFESSIONNEL ===
  
  // En-tête du tableau
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 10, 'F');
  
  // Bordure du tableau
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 10);
  
  // En-têtes de colonnes (optimisées pour l'espace)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  const colX1 = margin + 3; // Description
  const colX2 = margin + 70; // Prix unitaire
  const colX3 = margin + 95; // Quantité
  const colX4 = margin + 110; // Total HT
  const colX5 = margin + 135; // Frais Platform
  const colX6 = margin + 160; // Net Vendeur
  
  doc.text('Description', colX1, yPosition + 7);
  doc.text('Prix Unit.', colX2, yPosition + 7);
  doc.text('Qté', colX3, yPosition + 7);
  doc.text('Total HT', colX4, yPosition + 7);
  doc.text('Frais (5%)', colX5, yPosition + 7);
  doc.text('Net Vendeur', colX6, yPosition + 7);
  
  yPosition += 10;
  
  // Ligne de service
  const rowHeight = invoiceData.description ? 18 : 10;
  doc.rect(margin, yPosition, pageWidth - 2 * margin, rowHeight);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  // Description
  doc.text(invoiceData.title, colX1, yPosition + 7);
  if (invoiceData.description) {
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(invoiceData.description.substring(0, 25) + '...', colX1, yPosition + 12);
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  }
  
  // Calculs
  const amountPaid = invoiceData.amount;
  const rivvlockFee = amountPaid * 0.05;
  const amountReceived = amountPaid - rivvlockFee;
  const currency = invoiceData.currency.toUpperCase();
  
  // Valeurs dans le tableau
  doc.text(`${amountPaid.toFixed(2)}`, colX2, yPosition + 7);
  doc.text('1', colX3, yPosition + 7);
  doc.text(`${amountPaid.toFixed(2)}`, colX4, yPosition + 7);
  doc.text(`-${rivvlockFee.toFixed(2)}`, colX5, yPosition + 7);
  doc.text(`${amountReceived.toFixed(2)}`, colX6, yPosition + 7);
  
  yPosition += rowHeight + 15;
  
  // === SECTION CALCULS FINANCIERS ===
  
  const calcStartX = pageWidth - 100;
  
  // Sous-total
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant payé par l\'acheteur:', calcStartX - 60, yPosition);
  doc.text(`${amountPaid.toFixed(2)} ${currency}`, calcStartX, yPosition);
  
  yPosition += 8;
  
  // Frais plateforme
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]); // Noir pour les frais
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
  doc.text('Net reçu:', calcStartX - 60, yPosition);
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
  
  yPosition += 20;
  
  // === INFORMATIONS LÉGALES (Rectangle ajusté) ===
  
  // Cadre d'informations légales - plus petit et mieux ajusté
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 20, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 20);
  
  yPosition += 6;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('INFORMATIONS LÉGALES', margin + 3, yPosition);
  
  yPosition += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('• Cette facture certifie la réalisation de la transaction via notre service d\'escrow sécurisé.', margin + 3, yPosition);
  doc.text('• Les frais RivvLock (5%) sont déduits du montant reçu par le vendeur.', margin + 3, yPosition + 3);
  doc.text('• La transaction a été validée par l\'acheteur conformément aux conditions d\'utilisation.', margin + 3, yPosition + 6);
  
  yPosition += 15;
  
  // === PIED DE PAGE - COMPLÈTEMENT SÉPARÉ ===
  
  // Numéro de page (bas gauche)
  const footerY = pageHeight - 10;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(`Page 1/1 - Générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, margin, footerY);
  
  // Informations RivvLock (bas droite) - COMPLÈTEMENT EN DEHORS DU RECTANGLE
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  const footerRightText = 'RivvLock - Plateforme d\'escrow | contact@rivvlock.com';
  const footerTextWidth = doc.getTextWidth(footerRightText);
  doc.text(footerRightText, pageWidth - margin - footerTextWidth, footerY);
  
  // Télécharger le PDF avec numéro de facture automatique
  const fileName = `Facture-${invoiceNumber}.pdf`;
  doc.save(fileName);
};