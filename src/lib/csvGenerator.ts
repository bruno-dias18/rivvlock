interface Transaction {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  updated_at: string;
  buyer_display_name?: string;
  refund_status?: 'none' | 'partial' | 'full';
  refund_percentage?: number;
}

interface Invoice {
  invoice_number: string;
  transaction_id: string;
}

export const generateAnnualReportCSV = (
  transactions: Transaction[],
  invoices: Invoice[],
  language: string = 'fr'
): string => {
  const headers = language === 'fr' 
    ? ['Date de validation', 'N° Facture', 'Client', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Frais RivvLock', 'Net reçu', 'Devise']
    : language === 'de'
    ? ['Validierungsdatum', 'Rechnungsnr.', 'Kunde', 'Beschreibung', 'Betrag ohne MwSt.', 'MwSt.', 'Betrag mit MwSt.', 'RivvLock Gebühren', 'Nettobetrag', 'Währung']
    : ['Validation Date', 'Invoice No.', 'Client', 'Description', 'Amount excl. VAT', 'VAT', 'Amount incl. VAT', 'RivvLock Fees', 'Net Received', 'Currency'];
  
  const invoiceMap = new Map(invoices.map(inv => [inv.transaction_id, inv.invoice_number]));
  
  const rows = transactions.map(transaction => {
    const amountPaid = Number(transaction.price);
    const rivvlockFee = amountPaid * 0.05;
    let amountReceived = amountPaid - rivvlockFee;
    const invoiceNumber = invoiceMap.get(transaction.id) || '-';
    
    let description = transaction.description || transaction.title;
    if (transaction.refund_status === 'partial') {
      const refundNote = language === 'fr' ? ' (Remboursement partiel)' :
                         language === 'de' ? ' (Teilrückerstattung)' :
                         ' (Partial refund)';
      description += refundNote;
      
      if (transaction.refund_percentage) {
        const refundAmount = amountPaid * (transaction.refund_percentage / 100);
        amountReceived = amountPaid - refundAmount - rivvlockFee;
      }
    }
    
    const date = new Date(transaction.updated_at).toLocaleDateString(
      language === 'de' ? 'de-DE' : language === 'en' ? 'en-US' : 'fr-FR',
      { year: 'numeric', month: '2-digit', day: '2-digit' }
    );
    
    return [
      date,
      invoiceNumber,
      transaction.buyer_display_name || '-',
      `"${description.replace(/"/g, '""')}"`,
      amountPaid.toFixed(2),
      '0.00', // TVA
      amountPaid.toFixed(2),
      rivvlockFee.toFixed(2),
      amountReceived.toFixed(2),
      transaction.currency.toUpperCase()
    ].join(';');
  });
  
  return [headers.join(';'), ...rows].join('\n');
};
