/**
 * CAMT.053/054 XML Parser for Swiss Bank Statements
 * Parses ISO 20022 format (Bank to Customer Statement/Notification)
 */

export interface CamtTransaction {
  transactionId: string;
  valueDate: string;
  bookingDate?: string;
  amount: number;
  currency: string;
  debtorName?: string;
  debtorIban?: string;
  creditorName?: string;
  creditorIban?: string;
  reference?: string; // QR reference 27 digits
  unstructuredRemittance?: string;
  additionalInfo?: string;
}

export interface CamtStatement {
  accountIban: string;
  currency: string;
  statementDate: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions: CamtTransaction[];
}

/**
 * Extract text content from XML element
 */
function extractText(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract all occurrences of a tag
 */
function extractAll(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gis');
  const matches = [...xml.matchAll(regex)];
  return matches.map(m => m[1].trim());
}

/**
 * Extract amount with currency
 */
function extractAmount(xml: string, tag: string): { amount?: number; currency?: string } {
  const regex = new RegExp(`<${tag}[^>]*Ccy="([^"]+)"[^>]*>([^<]+)</${tag}>`, 'i');
  const match = xml.match(regex);
  if (match) {
    return {
      amount: parseFloat(match[2]),
      currency: match[1]
    };
  }
  return {};
}

/**
 * Parse transaction entry
 */
function parseTransaction(entryXml: string): CamtTransaction | null {
  try {
    const transactionId = extractText(entryXml, 'AcctSvcrRef') || 
                          extractText(entryXml, 'EndToEndId') || 
                          extractText(entryXml, 'TxId') || 
                          'unknown';
    
    const valueDate = extractText(entryXml, 'ValDt')?.replace(/<Dt>([^<]+)<\/Dt>/i, '$1') || 
                      extractText(entryXml, 'Dt') || '';
    
    const bookingDate = extractText(entryXml, 'BookgDt')?.replace(/<Dt>([^<]+)<\/Dt>/i, '$1') || 
                        extractText(entryXml, 'Dt');
    
    const amountData = extractAmount(entryXml, 'Amt');
    if (!amountData.amount) {
      return null;
    }

    // Check if debit or credit
    const cdtDbtInd = extractText(entryXml, 'CdtDbtInd');
    const amount = cdtDbtInd === 'DBIT' ? -Math.abs(amountData.amount) : Math.abs(amountData.amount);

    // Extract debtor information
    const debtorName = extractText(entryXml, 'Dbtr')?.match(/<Nm>([^<]+)<\/Nm>/i)?.[1];
    const debtorIban = extractText(entryXml, 'DbtrAcct')?.match(/<IBAN>([^<]+)<\/IBAN>/i)?.[1];

    // Extract creditor information
    const creditorName = extractText(entryXml, 'Cdtr')?.match(/<Nm>([^<]+)<\/Nm>/i)?.[1];
    const creditorIban = extractText(entryXml, 'CdtrAcct')?.match(/<IBAN>([^<]+)<\/IBAN>/i)?.[1];

    // Extract QR reference (27 digits) from structured remittance info
    let reference: string | undefined;
    const strdSection = extractText(entryXml, 'Strd');
    if (strdSection) {
      const refMatch = strdSection.match(/<Ref>(\d{27})<\/Ref>/i);
      if (refMatch) {
        reference = refMatch[1];
      }
    }

    // Extract unstructured remittance
    const unstructuredRemittance = extractText(entryXml, 'Ustrd');

    // Additional info from AddtlTxInf or AddtlNtryInf
    const additionalInfo = extractText(entryXml, 'AddtlTxInf') || extractText(entryXml, 'AddtlNtryInf');

    return {
      transactionId,
      valueDate,
      bookingDate,
      amount,
      currency: amountData.currency || 'CHF',
      debtorName,
      debtorIban,
      creditorName,
      creditorIban,
      reference,
      unstructuredRemittance,
      additionalInfo
    };
  } catch (error) {
    console.error('Error parsing transaction entry:', error);
    return null;
  }
}

/**
 * Parse CAMT.053 (Bank to Customer Statement)
 */
export function parseCamt053(xmlContent: string): CamtStatement {
  try {
    // Extract account IBAN
    const accountIban = extractText(xmlContent, 'IBAN') || '';
    
    // Extract currency
    const currencyMatch = xmlContent.match(/Ccy="([A-Z]{3})"/i);
    const currency = currencyMatch ? currencyMatch[1] : 'CHF';

    // Extract statement date
    const statementDate = extractText(xmlContent, 'CreDtTm')?.substring(0, 10) || 
                          extractText(xmlContent, 'Dt') || 
                          new Date().toISOString().substring(0, 10);

    // Extract opening balance
    const openingBalXml = xmlContent.match(/<Bal>.*?<Tp>.*?<CdOrPrtry>.*?<Cd>OPBD<\/Cd>.*?<\/CdOrPrtry>.*?<\/Tp>.*?<Amt[^>]*>([^<]+)<\/Amt>.*?<\/Bal>/is);
    const openingBalance = openingBalXml ? parseFloat(openingBalXml[1]) : undefined;

    // Extract closing balance
    const closingBalXml = xmlContent.match(/<Bal>.*?<Tp>.*?<CdOrPrtry>.*?<Cd>CLBD<\/Cd>.*?<\/CdOrPrtry>.*?<\/Tp>.*?<Amt[^>]*>([^<]+)<\/Amt>.*?<\/Bal>/is);
    const closingBalance = closingBalXml ? parseFloat(closingBalXml[1]) : undefined;

    // Extract all transaction entries
    const entriesXml = extractAll(xmlContent, 'Ntry');
    const transactions: CamtTransaction[] = [];

    for (const entryXml of entriesXml) {
      const transaction = parseTransaction(entryXml);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return {
      accountIban,
      currency,
      statementDate,
      openingBalance,
      closingBalance,
      transactions
    };
  } catch (error) {
    throw new Error(`Failed to parse CAMT.053: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse CAMT.054 (Bank to Customer Debit/Credit Notification)
 * Similar structure to CAMT.053 but for individual notifications
 */
export function parseCamt054(xmlContent: string): CamtStatement {
  // CAMT.054 has similar structure to CAMT.053
  return parseCamt053(xmlContent);
}

/**
 * Validate QR reference (27 digits with Modulo 10 recursive checksum)
 */
export function validateQrReference(reference: string): boolean {
  if (!/^\d{27}$/.test(reference)) {
    return false;
  }

  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;

  for (let i = 0; i < 27; i++) {
    const digit = parseInt(reference[i], 10);
    carry = table[(carry + digit) % 10];
  }

  return carry === 0;
}
