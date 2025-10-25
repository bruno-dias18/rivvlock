/**
 * Lazy-loaded PDF generator
 * This function dynamically imports the heavy jsPDF library only when needed
 */
export const generateInvoicePDF = async (...args: Parameters<typeof import('./pdfGenerator').generateInvoicePDF>) => {
  const { generateInvoicePDF: pdfGenerator } = await import('./pdfGenerator');
  return pdfGenerator(...args);
};
