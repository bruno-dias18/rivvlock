import jsPDF from 'jspdf';

interface AnnualReportData {
  year: number;
  transactions: any[];
  invoices: any[];
  totalRevenue: number;
  currency: string;
  sellerProfile: any;
  sellerEmail: string;
  language?: string;
  t?: any;
}

export const generateAnnualReportPDF = async (reportData: AnnualReportData) => {
  const { year, transactions, invoices, totalRevenue, currency, sellerProfile, sellerEmail, language = 'fr', t } = reportData;
  
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
  
  if (sellerProfile.user_type === 'company' && sellerProfile.company_name) {
    doc.text(sellerProfile.company_name, margin, yPosition);
    yPosition += 5;
  } else if (sellerProfile.first_name || sellerProfile.last_name) {
    doc.text(`${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim(), margin, yPosition);
    yPosition += 5;
  }
  
  if (sellerEmail) {
    doc.text(sellerEmail, margin, yPosition);
    yPosition += 5;
  }
  
  if (sellerProfile.siret_uid) {
    const siretLabel = sellerProfile.country === 'CH' ? 'UID' : 'SIRET';
    doc.text(`${siretLabel}: ${sellerProfile.siret_uid}`, margin, yPosition);
    yPosition += 5;
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
  const averageTransaction = totalRevenue / transactionCount;
  const totalFees = totalRevenue * 0.05;
  const netReceived = totalRevenue - totalFees;
  
  const summaryData = [
    [t?.('reports.period') || 'Période', `${year}`],
    [t?.('reports.transactionCount') || 'Nombre de transactions', transactionCount.toString()],
    [t?.('reports.totalRevenue') || 'Chiffre d\'affaires total', `${totalRevenue.toFixed(2)} ${currency.toUpperCase()}`],
    [t?.('reports.averageTransaction') || 'Montant moyen par transaction', `${averageTransaction.toFixed(2)} ${currency.toUpperCase()}`],
    [t?.('reports.totalFees') || 'Total frais RivvLock (5%)', `${totalFees.toFixed(2)} ${currency.toUpperCase()}`],
    [t?.('reports.netReceived') || 'Net reçu', `${netReceived.toFixed(2)} ${currency.toUpperCase()}`]
  ];
  
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
