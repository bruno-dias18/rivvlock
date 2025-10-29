/**
 * Swiss QR-Invoice Generator
 * Compliant with Swiss Payment Standards 2020
 * https://www.six-group.com/dam/download/banking-services/standardization/qr-bill/style-guide-qr-bill-en.pdf
 */

export interface QRInvoiceData {
  // Creditor (Bénéficiaire - GENINT SA)
  creditor: {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  // Debtor (Client payeur)
  debtor?: {
    name: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  // Payment details
  qrIban: string;
  amount: number;
  currency: string; // CHF ou EUR
  reference: string; // 27 digits QRR reference
  additionalInfo?: string;
  unstructuredMessage?: string;
}

/**
 * Generate Swiss QR-Invoice payload (text format for QR code)
 * Format according to Swiss Payment Standards 2020 Chapter 4
 */
export function generateQRInvoicePayload(data: QRInvoiceData): string {
  const lines: string[] = [];

  // 1. Swiss QR Code Type (fixed)
  lines.push('SPC'); // Swiss Payment Code
  lines.push('0200'); // Version 02.00
  lines.push('1'); // Coding Type UTF-8

  // 2. Account (QR-IBAN)
  lines.push(data.qrIban.replace(/\s/g, '')); // Remove spaces

  // 3. Creditor (Beneficiary) - GENINT SA
  lines.push('S'); // Structured address (S) or Combined (K)
  lines.push(data.creditor.name);
  lines.push(data.creditor.street);
  lines.push(data.creditor.postalCode);
  lines.push(data.creditor.city);
  lines.push(data.creditor.country);
  lines.push(''); // Building number (empty for structured)

  // 4. Ultimate Creditor (empty - not used)
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');

  // 5. Amount
  lines.push(data.amount.toFixed(2)); // Format: 1234.56
  lines.push(data.currency); // CHF or EUR

  // 6. Ultimate Debtor (Debtor - Client)
  if (data.debtor) {
    lines.push(data.debtor.street ? 'S' : 'K'); // Structured or Combined
    lines.push(data.debtor.name || '');
    lines.push(data.debtor.street || '');
    lines.push(data.debtor.postalCode || '');
    lines.push(data.debtor.city || '');
    lines.push(data.debtor.country || '');
    lines.push(''); // Building number
  } else {
    // Empty debtor
    lines.push('');
    lines.push('');
    lines.push('');
    lines.push('');
    lines.push('');
    lines.push('');
    lines.push('');
  }

  // 7. Reference Type & Reference
  lines.push('QRR'); // QR Reference (27 digits with checksum)
  lines.push(data.reference);

  // 8. Additional Information
  lines.push(data.unstructuredMessage || ''); // Unstructured message
  lines.push('EPD'); // End Payment Data (trailer)

  // 9. Billing Information (optional - empty for now)
  lines.push('');

  // 10. Alternative Schemes (optional - empty)
  lines.push('');
  lines.push('');

  return lines.join('\r\n');
}

/**
 * Generate QR code from QR-Invoice payload using AI Gateway
 * Returns base64 image data
 */
export async function generateQRCodeImage(
  payload: string,
  lovableApiKey: string
): Promise<string> {
  const prompt = `Generate a Swiss QR-Invoice QR code with the following data. The QR code must be square, black and white, with high error correction level. Include a small Swiss cross in the center as per Swiss QR-Invoice standards. The QR code should be scannable and professional-looking.

Data to encode:
${payload}

Generate a clean, high-resolution QR code image suitable for printing on invoices.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.statusText}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated from AI Gateway');
    }

    return imageUrl; // Returns data:image/png;base64,...
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Format Swiss QRR reference for display (groups of 5 digits)
 * Example: 210000000003993200140900116 -> 21 00000 00003 99320 01409 00116
 */
export function formatQRReference(reference: string): string {
  if (!reference || reference.length !== 27) {
    return reference;
  }
  
  return `${reference.substring(0, 2)} ${reference.substring(2, 7)} ${reference.substring(7, 12)} ${reference.substring(12, 17)} ${reference.substring(17, 22)} ${reference.substring(22, 27)}`;
}

/**
 * Format IBAN for display (groups of 4 characters)
 * Example: CH9830024507196252679 -> CH98 3002 4507 1962 5267 9
 */
export function formatIBAN(iban: string): string {
  const cleanIBAN = iban.replace(/\s/g, '');
  return cleanIBAN.match(/.{1,4}/g)?.join(' ') || iban;
}
