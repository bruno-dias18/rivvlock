import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateInvoicePDF } from '../pdfGenerator';

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        width: 210,
        height: 297,
      },
    },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    addImage: vi.fn(),
    save: vi.fn(),
    output: vi.fn(() => new Blob(['pdf content'], { type: 'application/pdf' })),
  })),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { invoiceNumber: 'FAC-2025-12345' },
        error: null,
      }),
    },
  },
}));

describe('pdfGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInvoiceData = {
    transactionId: 'txn-123',
    title: 'Test Service',
    description: 'Test description',
    amount: 100,
    currency: 'EUR',
    sellerName: 'Test Seller',
    buyerName: 'Test Buyer',
    serviceDate: new Date().toISOString(),
    validatedDate: new Date().toISOString(),
    language: 'fr',
    t: (key: string, defaultValue?: string) => defaultValue || key,
    viewerRole: 'seller' as const,
    refundStatus: 'none' as const,
    refundPercentage: 0,
  };

  it('should generate PDF with basic invoice data', async () => {
    const blob = await generateInvoicePDF(mockInvoiceData, true);

    expect(blob).toBeInstanceOf(Blob);
    if (blob) {
      expect(blob.type).toBe('application/pdf');
    }
  });

  it('should generate PDF with existing invoice number', async () => {
    const existingNumber = 'FAC-2025-EXISTING';
    const blob = await generateInvoicePDF(mockInvoiceData, true, existingNumber);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle seller profile data', async () => {
    const dataWithProfile = {
      ...mockInvoiceData,
      sellerProfile: {
        user_type: 'company' as const,
        company_name: 'Test Company',
        siret_uid: '12345678901234',
        vat_number: 'FR12345678901',
        phone: '+33123456789',
        address: '123 Test Street',
        postal_code: '75001',
        city: 'Paris',
        country: 'FR' as const,
      },
    };

    const blob = await generateInvoicePDF(dataWithProfile, true);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle buyer profile data', async () => {
    const dataWithBuyer = {
      ...mockInvoiceData,
      buyerProfile: {
        user_type: 'individual' as const,
        address: '456 Test Avenue',
        postal_code: '69001',
        city: 'Lyon',
        country: 'FR' as const,
      },
    };

    const blob = await generateInvoicePDF(dataWithBuyer, true);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle partial refund status', async () => {
    const refundData = {
      ...mockInvoiceData,
      refundStatus: 'partial' as const,
      refundPercentage: 50,
    };

    const blob = await generateInvoicePDF(refundData, true);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle full refund status', async () => {
    const refundData = {
      ...mockInvoiceData,
      refundStatus: 'full' as const,
    };

    const blob = await generateInvoicePDF(refundData, true);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle different currencies', async () => {
    const chfData = {
      ...mockInvoiceData,
      currency: 'CHF',
    };

    const blob = await generateInvoicePDF(chfData, true);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle different languages', async () => {
    const deData = {
      ...mockInvoiceData,
      language: 'de',
      t: (key: string, defaultValue?: string) => defaultValue || key,
    };

    const blob = await generateInvoicePDF(deData, true);

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should fallback to timestamp-based invoice number on error', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: new Error('Invoice generation failed'),
    });

    const blob = await generateInvoicePDF(mockInvoiceData, true);

    expect(blob).toBeInstanceOf(Blob);
  });
});
