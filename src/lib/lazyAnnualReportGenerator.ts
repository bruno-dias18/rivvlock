/**
 * Lazy-loaded Annual Report Generator
 * This function dynamically imports the heavy jsPDF + JSZip libraries only when needed
 */

export const generateAnnualReportPDF = async (...args: Parameters<typeof import('./annualReportGenerator').generateAnnualReportPDF>) => {
  const { generateAnnualReportPDF: generator } = await import('./annualReportGenerator');
  return generator(...args);
};

export const downloadAllInvoicesAsZip = async (...args: Parameters<typeof import('./annualReportGenerator').downloadAllInvoicesAsZip>) => {
  const { downloadAllInvoicesAsZip: generator } = await import('./annualReportGenerator');
  return generator(...args);
};

export type { AnnualReportData } from './annualReportGenerator';
