import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface InvoiceData {
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
  language?: string;
  t?: any;
  viewerRole?: 'seller' | 'buyer';
  refundStatus?: 'none' | 'partial' | 'full';
  refundPercentage?: number;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal?: number;
  discount_percentage?: number;
  tax_rate?: number;
  tax_amount?: number;
}

// Base64 du logo RivvLock (cadenas bleu) - Version optimisée pour PDF
const RIVVLOCK_LOGO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAoACgDASIAAhEBAxEB/8QAGwABAAIDAQEAAAAAAAAAAAAAAAMEAQIGBQf/xAA0EAABAwMBBQYGAQQDAAAAAAABAAIDBBEhBRIxQVFhBhMicYGRFDKhscHR4fAjQlJi8f/EABsBAAIDAQEBAAAAAAAAAAAAAAAGAwQFAgEH/8QALBEAAgECBQIEBwAAAAAAAAAAAAECAwQFESFBIFESYcHwMVKBkbHh8UKSocL/2gAMAwEAAhEDEQA/APEREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAf/Z';

export const generateInvoicePDF = async (
  invoiceData: InvoiceData, 
  returnBlob = false,
  existingInvoiceNumber?: string
): Promise<Blob | void> => {
  // Dynamic import of jsPDF - lazy loading
  const { default: jsPDF } = await import('jspdf');
  
  const { language = 'fr', t } = invoiceData;
  
  // Generate unique invoice number
  let invoiceNumber: string;
  
  // Si un numéro de facture existant est fourni, l'utiliser directement
  if (existingInvoiceNumber) {
    invoiceNumber = existingInvoiceNumber;
    logger.log('Using existing invoice number:', invoiceNumber);
  } else {
    // Sinon, générer un nouveau numéro via l'edge function
    try {
      const { data: response, error } = await supabase.functions.invoke('generate-invoice-number', {
        body: {
          transactionId: invoiceData.transactionId,
          sellerId: invoiceData.sellerProfile?.user_id,
          buyerId: invoiceData.buyerProfile?.user_id,
          amount: invoiceData.amount,
          currency: invoiceData.currency
        }
      });

      if (error) {
        logger.error('Error generating invoice number:', error);
        // Fallback to timestamp-based number if service fails
        invoiceNumber = `FAC-${new Date().getFullYear()}-${Date.now()}`;
      } else {
        invoiceNumber = response.invoiceNumber;
      }
    } catch (error) {
      logger.error('Failed to call invoice number service:', error);
      // Fallback to timestamp-based number
      invoiceNumber = `FAC-${new Date().getFullYear()}-${Date.now()}`;
    }
  }

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
  
  // Invoice number is now generated above before creating PDF
  const dateOptions: Intl.DateTimeFormatOptions = { 
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const locale = language === 'de' ? 'de-DE' : language === 'en' ? 'en-US' : 'fr-FR';
  const invoiceDate = new Date(invoiceData.validatedDate).toLocaleDateString(locale, dateOptions);
  
  // RIVVLOCK à gauche et FACTURE à droite sur la même ligne
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RIVVLOCK', margin, yPosition);
  doc.text(t?.('invoice.title') || 'FACTURE', rightX, yPosition, { align: 'right' });
  
  yPosition += 8;
  
  // Sous-informations RIVVLOCK (à gauche)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(t?.('invoice.secureEscrowPlatform') || 'Plateforme d\'escrow sécurisée', margin, yPosition);
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
  doc.text(t?.('invoice.sender') || 'ÉMETTEUR', margin, yPosition);
  doc.text(t?.('invoice.client') || 'CLIENT', clientStartX, yPosition);
  
  yPosition += 8;
  
  // Informations émetteur (colonne gauche)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.sellerName, margin, yPosition);
  
  let leftColumnY = yPosition + 4;
  doc.setFont('helvetica', 'normal');
  
  if (invoiceData.sellerProfile) {
    const profile = invoiceData.sellerProfile;
    
    // Affichage adapté selon le type d'utilisateur
    if (profile.user_type === 'company') {
      // Pour les entreprises - ne pas réafficher le nom de société (déjà dans sellerName)
      
      if (profile.siret_uid) {
        const siretLabel = profile.country === 'CH' ? 'UID' : 'SIRET';
        doc.text(`${siretLabel}: ${profile.siret_uid}`, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      if (profile.vat_number) {
        doc.text(`${t?.('invoice.vatNumber') || 'N° TVA'}: ${profile.vat_number}`, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      if (invoiceData.sellerEmail) {
        doc.text(invoiceData.sellerEmail, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      if (profile.phone) {
        const phoneLabel = language === 'de' ? 'Tel' : language === 'en' ? 'Tel' : 'Tél';
        doc.text(`${phoneLabel}: ${profile.phone}`, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      // Utiliser l'adresse d'entreprise pour les sociétés
      if (profile.company_address) {
        doc.text(profile.company_address, margin, leftColumnY);
        leftColumnY += 4;
      } else if (profile.address) {
        doc.text(profile.address, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      if (profile.postal_code && profile.city) {
        doc.text(`${profile.postal_code} ${profile.city}`, margin, leftColumnY);
        leftColumnY += 4;
      }
    } else {
      // Pour les particuliers et indépendants - ne pas réafficher le nom (déjà dans sellerName)
      
      if (invoiceData.sellerEmail) {
        doc.text(invoiceData.sellerEmail, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      if (profile.phone) {
        const phoneLabel = language === 'de' ? 'Tel' : language === 'en' ? 'Tel' : 'Tél';
        doc.text(`${phoneLabel}: ${profile.phone}`, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      // Pour les indépendants, ajouter le numéro AVS si disponible
      if (profile.user_type === 'independent' && profile.avs_number) {
        doc.text(`${t?.('invoice.avsNumber') || 'N° AVS'}: ${profile.avs_number}`, margin, leftColumnY);
        leftColumnY += 4;
      }
      
      // Afficher le statut d'assujettissement TVA pour les indépendants
      if (profile.user_type === 'independent' && profile.is_subject_to_vat) {
        doc.text(`${t?.('invoice.vatSubject') || 'Assujetti TVA'}`, margin, leftColumnY);
        leftColumnY += 4;
        
        const rate = profile.country === 'FR' ? profile.tva_rate : profile.vat_rate;
        if (rate) {
          doc.text(`${t?.('invoice.vatRate') || 'Taux TVA'}: ${rate}%`, margin, leftColumnY);
          leftColumnY += 4;
        }
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
    
    // Affichage adapté selon le type d'utilisateur
    if (profile.user_type === 'company') {
      // Pour les entreprises - ne pas réafficher le nom de société (déjà dans buyerName)
      
      if (profile.siret_uid) {
        const siretLabel = profile.country === 'CH' ? 'UID' : 'SIRET';
        doc.text(`${siretLabel}: ${profile.siret_uid}`, clientX, rightColumnY);
        rightColumnY += 4;
      }
      
      if (profile.vat_number) {
        doc.text(`${t?.('invoice.vatNumber') || 'N° TVA'}: ${profile.vat_number}`, clientX, rightColumnY);
        rightColumnY += 4;
      }
      
      if (invoiceData.buyerEmail) {
        const emailLines = doc.splitTextToSize(invoiceData.buyerEmail, clientWidth);
        doc.text(emailLines, clientX, rightColumnY);
        rightColumnY += emailLines.length * 4;
      }
      
      if (profile.phone) {
        const phoneLabel = language === 'de' ? 'Tel' : language === 'en' ? 'Tel' : 'Tél';
        doc.text(`${phoneLabel}: ${profile.phone}`, clientX, rightColumnY);
        rightColumnY += 4;
      }
      
      // Utiliser l'adresse d'entreprise pour les sociétés
      if (profile.company_address) {
        const addressLines = doc.splitTextToSize(profile.company_address, clientWidth);
        doc.text(addressLines, clientX, rightColumnY);
        rightColumnY += addressLines.length * 4;
      } else if (profile.address) {
        const addressLines = doc.splitTextToSize(profile.address, clientWidth);
        doc.text(addressLines, clientX, rightColumnY);
        rightColumnY += addressLines.length * 4;
      }
      
      if (profile.postal_code && profile.city) {
        doc.text(`${profile.postal_code} ${profile.city}`, clientX, rightColumnY);
        rightColumnY += 4;
      }
    } else {
      // Pour les particuliers et indépendants - ne pas réafficher le nom (déjà dans buyerName)
      
      if (invoiceData.buyerEmail) {
        const emailLines = doc.splitTextToSize(invoiceData.buyerEmail, clientWidth);
        doc.text(emailLines, clientX, rightColumnY);
        rightColumnY += emailLines.length * 4;
      }
      
      if (profile.phone) {
        const phoneLabel = language === 'de' ? 'Tel' : language === 'en' ? 'Tel' : 'Tél';
        doc.text(`${phoneLabel}: ${profile.phone}`, clientX, rightColumnY);
        rightColumnY += 4;
      }
      
      // Pour les indépendants, ajouter le numéro AVS si disponible
      if (profile.user_type === 'independent' && profile.avs_number) {
        doc.text(`${t?.('invoice.avsNumber') || 'N° AVS'}: ${profile.avs_number}`, clientX, rightColumnY);
        rightColumnY += 4;
      }
      
      // Afficher le statut d'assujettissement TVA pour les indépendants
      if (profile.user_type === 'independent' && profile.is_subject_to_vat) {
        doc.text(`${t?.('invoice.vatSubject') || 'Assujetti TVA'}`, clientX, rightColumnY);
        rightColumnY += 4;
        
        if (profile.tva_rate) {
          doc.text(`${t?.('invoice.vatRate') || 'Taux TVA'}: ${profile.tva_rate}%`, clientX, rightColumnY);
          rightColumnY += 4;
        }
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
  }
  
  // Ajuster la position selon la colonne la plus longue
  yPosition = Math.max(leftColumnY, rightColumnY) + 15;
  
  // Affichage pour remboursement total
  if (invoiceData.refundStatus === 'full') {
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38);
    doc.setFont("helvetica", "bold");
    const cancelText = language === 'fr' ? 'FACTURE ANNULÉE - REMBOURSEMENT TOTAL' :
                       language === 'de' ? 'RECHNUNG STORNIERT - VOLLSTÄNDIGE RÜCKERSTATTUNG' :
                       'INVOICE CANCELLED - FULL REFUND';
    doc.text(cancelText, pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    yPosition += 15;
  }
  
  // === TABLEAU SIMPLIFIÉ (selon modèle) ===
  
  // Calculs pour le tableau
  let amountPaid = invoiceData.amount;
  let refundAmount = 0;
  let buyerFees = 0;
  let sellerFees = 0;
  
  // Appliquer le remboursement partiel si applicable
  if (invoiceData.refundStatus === 'partial' && invoiceData.refundPercentage) {
    refundAmount = invoiceData.amount * (invoiceData.refundPercentage / 100);
    const totalFees = invoiceData.amount * 0.05; // 5% de frais totaux
    
    // Les frais sont partagés proportionnellement
    buyerFees = totalFees * (invoiceData.refundPercentage / 100); // Frais sur la partie remboursée
    sellerFees = totalFees * ((100 - invoiceData.refundPercentage) / 100); // Frais sur la partie conservée
    
    // Le montant effectivement payé par l'acheteur
    amountPaid = invoiceData.amount - (refundAmount - buyerFees);
  } else if (invoiceData.refundStatus === 'full') {
    // Pour remboursement total, montants à 0
    amountPaid = 0;
    refundAmount = invoiceData.amount;
    const totalFees = invoiceData.amount * 0.05;
    buyerFees = totalFees; // Tous les frais sont à la charge de l'acheteur
  } else {
    // Transaction normale - le vendeur paie 5% de frais
    const totalFees = invoiceData.amount * 0.05;
    sellerFees = totalFees;
    buyerFees = 0; // L'acheteur ne paie pas de frais sur une transaction normale
  }
  
  const rivvlockFee = invoiceData.viewerRole === 'seller' ? sellerFees : buyerFees;
  const amountReceived = invoiceData.viewerRole === 'seller' 
    ? (invoiceData.amount - refundAmount - sellerFees)
    : (refundAmount - buyerFees);
  const currency = invoiceData.currency.toUpperCase();

  // Pré-calcul TVA pour la ligne "Total HT"
  const earlySellerCountry = invoiceData.sellerProfile?.country;
  const earlySellerVatRate = (earlySellerCountry === 'FR' ? invoiceData.sellerProfile?.tva_rate : invoiceData.sellerProfile?.vat_rate) ?? 0;
  const earlySellerHasVat = invoiceData.sellerProfile?.user_type !== 'individual' && invoiceData.sellerProfile?.is_subject_to_vat && earlySellerVatRate;
  // Use amountPaid (which includes refund calculation) for the table row
  const baseAmountRow = earlySellerHasVat
    ? ((invoiceData.amount - refundAmount) / (1 + (earlySellerVatRate / 100)))
    : (invoiceData.amount - refundAmount);
  
  // En-tête tableau avec bordure
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 8);
  
  // En-têtes colonnes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  const colDesignation = margin + 2;
  const colPriceHT = margin + 100;
  const colQty = margin + 140;
  const colTotalHT = margin + 160;
  
  doc.text(t?.('invoice.designation') || 'Désignation', colDesignation, yPosition + 5.5);
  doc.text(earlySellerHasVat ? (t?.('invoice.priceHT') || 'Prix HT') : (t?.('invoice.price') || 'Prix'), colPriceHT, yPosition + 5.5);
  doc.text(t?.('invoice.quantity') || 'Qté', colQty, yPosition + 5.5);
  doc.text(earlySellerHasVat ? (t?.('invoice.totalHT') || 'Total HT') : (t?.('invoice.total') || 'Total'), colTotalHT, yPosition + 5.5);
  
  yPosition += 8;
  
  // Si items existent, les afficher tous
  if (invoiceData.items && invoiceData.items.length > 0) {
    invoiceData.items.forEach((item, index) => {
      const contentHeight = 10;
      doc.rect(margin, yPosition, pageWidth - 2 * margin, contentHeight);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      
      // Description
      const descLines = doc.splitTextToSize(item.description, 90);
      doc.text(descLines, colDesignation, yPosition + 6);
      
      // Prix unitaire HT
      doc.text(`${item.unit_price.toFixed(2)} ${currency}`, colPriceHT, yPosition + 6);
      
      // Quantité
      doc.text(`${item.quantity}`, colQty, yPosition + 6, { align: 'center' });
      
      // Total HT
      doc.text(`${item.total.toFixed(2)} ${currency}`, colTotalHT, yPosition + 6);
      
      yPosition += contentHeight;
    });
  } else {
    // Fallback: ligne unique avec title/description
    const contentHeight = invoiceData.description ? 16 : 10;
    doc.rect(margin, yPosition, pageWidth - 2 * margin, contentHeight);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    doc.text(invoiceData.title, colDesignation, yPosition + 6);
    if (invoiceData.description) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(invoiceData.description.substring(0, 40) + '...', colDesignation, yPosition + 12);
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
    }
    
    const rowUnitAmount = baseAmountRow;
    doc.text(`${rowUnitAmount.toFixed(2)} ${currency}`, colPriceHT, yPosition + 6);
    doc.text('1', colQty, yPosition + 6, { align: 'center' });
    doc.text(`${rowUnitAmount.toFixed(2)} ${currency}`, colTotalHT, yPosition + 6);
    
    yPosition += contentHeight;
  }
  
  yPosition += 15;
  
  // Ne plus afficher de ligne de remboursement séparée
  // Le montant dans le tableau est déjà le montant final (après remboursement)
  
  // === CALCULS FINANCIERS (alignés avec le bord droit du tableau) ===
  
  const labelX = rightColX;
  const valueX = tableRightEdge; // Alignement parfait avec le bord droit du tableau
  
  // Déterminer si on doit afficher la TVA
  const sellerCountry = invoiceData.sellerProfile?.country;
  const sellerVatRate = sellerCountry === 'FR' ? invoiceData.sellerProfile?.tva_rate : invoiceData.sellerProfile?.vat_rate;
  const sellerHasVat = invoiceData.sellerProfile?.user_type !== 'individual' && 
                       invoiceData.sellerProfile?.is_subject_to_vat && 
                       sellerVatRate;
  
  let baseAmount = (invoiceData.amount - refundAmount);
  let vatAmount = 0;
  let totalTTC = (invoiceData.amount - refundAmount);
  
  if (sellerHasVat) {
    // Compute VAT based on amount AFTER refund (effective TTC)
    const vatRate = (sellerVatRate ?? 0) / 100;
    const effectiveTTC = (invoiceData.amount - refundAmount);
    baseAmount = effectiveTTC / (1 + vatRate);
    vatAmount = effectiveTTC - baseAmount;
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  // 1. Subtotal (si disponible et différent du baseAmount)
  if (invoiceData.subtotal && invoiceData.items && invoiceData.items.length > 0) {
    doc.text(`${t?.('invoice.subtotal') || 'Sous-total'}:`, labelX, yPosition, { align: 'left' });
    doc.text(`${invoiceData.subtotal.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 8;
  }
  
  // 2. Rabais (si applicable)
  if (invoiceData.discount_percentage && invoiceData.discount_percentage > 0) {
    const discountAmount = (invoiceData.subtotal || baseAmount) * (invoiceData.discount_percentage / 100);
    doc.text(`${t?.('invoice.discount') || 'Rabais'} (${invoiceData.discount_percentage}%):`, labelX, yPosition, { align: 'left' });
    doc.text(`-${discountAmount.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 8;
  }
  
  // 3. Total HT (après rabais)
  doc.text(`${t?.('invoice.totalHT') || 'Total HT'}:`, labelX, yPosition, { align: 'left' });
  doc.text(`${baseAmount.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
  
  yPosition += 8;
  
  // TVA (si applicable)
  if (sellerHasVat) {
    doc.text(`${t?.('invoice.vatAmount') || 'TVA'} (${sellerVatRate}%):`, labelX, yPosition, { align: 'left' });
    doc.text(`${vatAmount.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 8;
    
    // Total TTC
    doc.setFont('helvetica', 'bold');
    doc.text(`${t?.('invoice.totalTTC') || 'Total TTC'}:`, labelX, yPosition, { align: 'left' });
    doc.text(`${totalTTC.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 8;
    doc.setFont('helvetica', 'normal');
  }
  
  // Frais RivvLock et montants finaux selon le rôle du lecteur
  if (invoiceData.viewerRole === 'seller') {
    // Afficher les frais plateforme pour le vendeur
    doc.text(`${t?.('invoice.rivvlockFees') || 'Frais RivvLock (5%)'}:`, labelX, yPosition, { align: 'left' });
    doc.text(`${rivvlockFee.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 8;

    // Net reçu par le vendeur
    doc.setFont('helvetica', 'bold');
    doc.text(`${t?.('invoice.netReceived') || 'Net reçu'}:`, labelX, yPosition, { align: 'left' });
    doc.text(`${amountReceived.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 10;
  } else {
    // Côté acheteur
    // Afficher les frais RivvLock si remboursement (partiel ou total)
    if (invoiceData.refundStatus !== 'none') {
      doc.text(`${t?.('invoice.rivvlockFees') || 'Frais RivvLock'}:`, labelX, yPosition, { align: 'left' });
      doc.text(`${rivvlockFee.toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
      yPosition += 8;
    }
    
    // Montant final à payer
    doc.setFont('helvetica', 'bold');
    doc.text(`${t?.('invoice.toPay') || 'Montant à payer'}:`, labelX, yPosition, { align: 'left' });
    doc.text(`${(invoiceData.amount - refundAmount + rivvlockFee).toFixed(2)} ${currency}`, valueX, yPosition, { align: 'right' });
    yPosition += 10;
  }
  
  yPosition += 20;
  
  // === INFORMATIONS COMPLÉMENTAIRES (simplifiées) ===
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  // Calculer la date de service effective à afficher
  let effectiveServiceDate = invoiceData.serviceDate 
    ? new Date(invoiceData.serviceDate) 
    : null;

  const validatedDateTime = new Date(invoiceData.validatedDate);

  // Si la date de service est postérieure à la validation, utiliser la date de validation
  if (effectiveServiceDate && effectiveServiceDate > validatedDateTime) {
    effectiveServiceDate = validatedDateTime;
  }

  // Afficher la date de service (si elle existe)
  if (effectiveServiceDate) {
    const serviceDate = effectiveServiceDate.toLocaleDateString(locale, dateOptions);
    doc.text(`${t?.('invoice.servicePerformed') || 'Service réalisé le'}: ${serviceDate}`, margin, yPosition);
    yPosition += 5;
  }
  
  const validatedDate = validatedDateTime.toLocaleDateString(locale, dateOptions);
  doc.text(`${t?.('invoice.transactionValidated') || 'Transaction validée le'}: ${validatedDate}`, margin, yPosition);
  yPosition += 15;
  
  // === PIED DE PAGE SIMPLIFIÉ ===
  
  // Contact RivvLock centré en bas
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const platformText = t?.('invoice.secureEscrowPlatform') || 'Plateforme d\'escrow sécurisée';
  const contactText = t?.('invoice.contact') || 'Contact';
  const footerText = `RivvLock - ${platformText} | ${contactText}: contact@rivvlock.com | www.rivvlock.com`;
  const footerTextWidth = doc.getTextWidth(footerText);
  doc.text(footerText, (pageWidth - footerTextWidth) / 2, footerY);
  
  // Retourner blob ou télécharger selon le paramètre
  if (returnBlob) {
    return doc.output('blob');
  } else {
    const invoiceLabel = t?.('common.invoice') || 'Facture';
    const fileName = `${invoiceLabel}-${invoiceNumber}.pdf`;
    doc.save(fileName);
  }
};