import { describe, it, expect } from 'vitest';
import { generateAnnualReportCSV } from '../csvGenerator';

describe('csvGenerator', () => {
  const mockTransactions = [
    {
      id: 'txn-1',
      title: 'Service 1',
      price: 100,
      currency: 'EUR',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
      status: 'validated' as const,
      refund_percentage: null,
      refund_status: null,
    },
    {
      id: 'txn-2',
      title: 'Service 2',
      price: 200,
      currency: 'CHF',
      created_at: '2025-02-20T14:00:00Z',
      updated_at: '2025-02-20T14:00:00Z',
      status: 'validated' as const,
      refund_percentage: null,
      refund_status: null,
    },
  ] as any;

  const mockInvoices = [
    {
      transaction_id: 'txn-1',
      invoice_number: 'FAC-2025-001',
    },
    {
      transaction_id: 'txn-2',
      invoice_number: 'FAC-2025-002',
    },
  ];

  it('should generate CSV with header and rows', () => {
    const csv = generateAnnualReportCSV(mockTransactions, mockInvoices, 'fr', 0);

    expect(csv).toContain('N° Facture');
    expect(csv).toContain('Titre');
    expect(csv).toContain('Date');
    expect(csv).toContain('FAC-2025-001');
    expect(csv).toContain('Service 1');
  });

  it('should handle French language', () => {
    const csv = generateAnnualReportCSV(mockTransactions, mockInvoices, 'fr', 0);

    expect(csv).toContain('N° Facture');
    expect(csv).toContain('Montant HT');
    expect(csv).toContain('TVA');
  });

  it('should handle German language', () => {
    const csv = generateAnnualReportCSV(mockTransactions, mockInvoices, 'de', 0);

    expect(csv).toContain('Rechnungsnummer');
    expect(csv).toContain('Betrag exkl. MwSt');
    expect(csv).toContain('MwSt');
  });

  it('should handle English language', () => {
    const csv = generateAnnualReportCSV(mockTransactions, mockInvoices, 'en', 0);

    expect(csv).toContain('Invoice Number');
    expect(csv).toContain('Amount excl. VAT');
    expect(csv).toContain('VAT');
  });

  it('should calculate VAT correctly', () => {
    const csv = generateAnnualReportCSV(mockTransactions, mockInvoices, 'fr', 20);

    // With 20% VAT, 100 EUR should be split as 83.33 HT + 16.67 VAT
    expect(csv).toMatch(/83[.,]33/); // HT amount
  });

  it('should handle transactions without invoices', () => {
    const csv = generateAnnualReportCSV(mockTransactions, [], 'fr', 0);

    expect(csv).toContain('N/A'); // Should show N/A for missing invoice numbers
  });

  it('should handle partial refunds', () => {
    const refundTransactions = [
      {
        ...mockTransactions[0],
        refund_status: 'partial' as const,
        refund_percentage: 50,
      },
    ];

    const csv = generateAnnualReportCSV(refundTransactions, mockInvoices, 'fr', 0);

    expect(csv).toContain('Service 1');
    // Should have reduced amounts due to partial refund
  });

  it('should handle full refunds', () => {
    const refundTransactions = [
      {
        ...mockTransactions[0],
        refund_status: 'full' as const,
      },
    ];

    const csv = generateAnnualReportCSV(refundTransactions, mockInvoices, 'fr', 0);

    expect(csv).toContain('0.00'); // Full refund = 0 net amount
  });

  it('should escape descriptions with quotes', () => {
    const transactionsWithQuotes = [
      {
        ...mockTransactions[0],
        title: 'Service "Special"',
      },
    ];

    const csv = generateAnnualReportCSV(transactionsWithQuotes, mockInvoices, 'fr', 0);

    // Should properly escape quotes in CSV
    expect(csv).toContain('""'); // Escaped quotes
  });

  it('should handle empty transactions array', () => {
    const csv = generateAnnualReportCSV([], [], 'fr', 0);

    // Should still have header
    expect(csv).toContain('N° Facture');
    // But no data rows
    expect(csv.split('\n').length).toBeLessThanOrEqual(2);
  });
});
