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
  language: string = 'fr',
  vatRate: number = 0
): string => {
  const headers = language === 'fr' 
    ? ['Date de validation', 'N° Facture', 'Client', 'Description', 'Montant HT', 'TVA', 'Montant TTC', 'Frais RivvLock', 'Net reçu', 'Devise']
    : language === 'de'
    ? ['Validierungsdatum', 'Rechnungsnr.', 'Kunde', 'Beschreibung', 'Betrag ohne MwSt.', 'MwSt.', 'Betrag mit MwSt.', 'RivvLock Gebühren', 'Nettobetrag', 'Währung']
    : ['Validation Date', 'Invoice No.', 'Client', 'Description', 'Amount excl. VAT', 'VAT', 'Amount incl. VAT', 'RivvLock Fees', 'Net Received', 'Currency'];
  
  const invoiceMap = new Map(invoices.map(inv => [inv.transaction_id, inv.invoice_number]));
  
  const rows = transactions.map(transaction => {
    let amountPaid = Number(transaction.price);
    const pct = Number(transaction.refund_percentage || 0);
    
    // Appliquer le remboursement partiel si applicable
    if ((transaction.refund_status === 'partial' || pct > 0) && pct > 0) {
      amountPaid = amountPaid * (1 - pct / 100);
    }
    
    // Le prix de la transaction est le montant TTC (ce que le client a payé)
    const amountTTC = amountPaid;
    // Décomposer pour trouver le HT et la TVA
    const amountHT = vatRate > 0 ? amountTTC / (1 + vatRate / 100) : amountTTC;
    const vatAmount = amountTTC - amountHT;
    
    const rivvlockFee = amountPaid * 0.05;
    let amountReceived = amountPaid - rivvlockFee;
    const invoiceNumber = invoiceMap.get(transaction.id) || '-';
    
    let description = transaction.description || transaction.title;
    if ((transaction.refund_status === 'partial' || pct > 0) && pct > 0) {
      const refundNote = language === 'fr' ? ` (Remb. partiel ${pct}%)` :
                         language === 'de' ? ` (Teilrückerstattung ${pct}%)` :
                         ` (Partial refund ${pct}%)`;
      description += refundNote;
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
      amountHT.toFixed(2),
      vatAmount.toFixed(2),
      amountTTC.toFixed(2),
      rivvlockFee.toFixed(2),
      amountReceived.toFixed(2),
      transaction.currency.toUpperCase()
    ].join(';');
  });
  
  return [headers.join(';'), ...rows].join('\n');
};
