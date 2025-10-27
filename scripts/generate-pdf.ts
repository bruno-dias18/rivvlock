import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as fs from 'fs';
import * as path from 'path';

interface CompetitorData {
  name: string;
  zone: string;
  type: string;
  fees: string;
  fixedFees: string;
  technicalSetup: string;
  targetClients: string;
  regulation: string;
  includedServices: string;
  isRivvlock?: boolean;
}

const COMPETITORS: CompetitorData[] = [
  {
    name: 'RivvLock',
    zone: '🇨🇭 CH/EU',
    type: 'Escrow Platform',
    fees: '5% TTC (Stripe inclus)',
    fixedFees: 'Abonnement: Admin + Facturation + Bilan annuel',
    technicalSetup: '✅ No-code, 5 min',
    targetClients: 'Services, Freelance, E-commerce',
    regulation: 'Swiss Compliance (nLPD)',
    includedServices: 'Escrow, Disputes, Chat, Factures, Support',
    isRivvlock: true,
  },
  {
    name: 'Escrow.com',
    zone: '🌍 Global',
    type: 'Pure Escrow',
    fees: '0.89% - 3.25%',
    fixedFees: '+ min $25',
    technicalSetup: '⚠️ KYC complexe',
    targetClients: 'Domaines, Véhicules, High-value',
    regulation: 'US Licensed',
    includedServices: 'Escrow uniquement',
  },
  {
    name: 'Stripe Connect',
    zone: '🌍 Global',
    type: 'PSP/Infrastructure',
    fees: '2.9% + 0.30€',
    fixedFees: 'Par transaction',
    technicalSetup: '❌ Intégration dev',
    targetClients: 'Marketplaces techniques',
    regulation: 'PCI-DSS Level 1',
    includedServices: 'API, Webhooks (escrow à coder)',
  },
  {
    name: 'Mangopay',
    zone: '🇫🇷 FR/EU',
    type: 'PSP Escrow',
    fees: '1.8% + 0.18€',
    fixedFees: '+ setup 2500€',
    technicalSetup: '❌ Intégration dev',
    targetClients: 'Marketplaces, Plateformes',
    regulation: 'EMI License FR',
    includedServices: 'E-wallets, KYC, API',
  },
  {
    name: 'Lemonway',
    zone: '🇫🇷 FR/EU',
    type: 'PSP Escrow',
    fees: '1.2% + 0.18€',
    fixedFees: '+ setup variable',
    technicalSetup: '❌ Intégration dev',
    targetClients: 'Crowdfunding, Marketplaces',
    regulation: 'EMI License FR',
    includedServices: 'E-wallets, KYC, Compliance',
  },
  {
    name: 'Tripartie',
    zone: '🇫🇷 FR',
    type: 'Escrow B2C',
    fees: '2.5% - 5%',
    fixedFees: 'Selon volume',
    technicalSetup: '⚠️ API/Plugin',
    targetClients: 'E-commerce, Leboncoin',
    regulation: 'Partenaire bancaire FR',
    includedServices: 'Escrow, Disputes, Assurance colis',
  },
  {
    name: 'HiPay',
    zone: '🇫🇷 FR/EU',
    type: 'PSP Full',
    fees: '2.5% + 0.25€',
    fixedFees: 'Négociable',
    technicalSetup: '❌ Intégration dev',
    targetClients: 'E-commerce, Retail',
    regulation: 'EMI License FR',
    includedServices: 'Paiements, Split-payment',
  },
  {
    name: 'CentralPay',
    zone: '🇫🇷 FR',
    type: 'Split Payment',
    fees: '2% - 4%',
    fixedFees: 'Variable',
    technicalSetup: '⚠️ Intégration moyenne',
    targetClients: 'Marketplaces FR',
    regulation: 'Partenaire Crédit Agricole',
    includedServices: 'Split, Escrow partiel',
  },
  {
    name: 'OPP (Online Payment Platform)',
    zone: '🇩🇪 DE',
    type: 'Marketplace Escrow',
    fees: '1.9% + 0.35€',
    fixedFees: 'Par transaction',
    technicalSetup: '❌ API complète',
    targetClients: 'Marketplaces allemandes',
    regulation: 'BaFin License DE',
    includedServices: 'Escrow, Identity, Compliance',
  },
  {
    name: 'Adyen for Platforms',
    zone: '🌍 Global',
    type: 'PSP Enterprise',
    fees: '2% - 3.5%',
    fixedFees: '+ setup > 50k€',
    technicalSetup: '❌ Intégration complexe',
    targetClients: 'Grandes plateformes',
    regulation: 'Multiple licenses',
    includedServices: 'Full-stack, KYC, Risk',
  },
  {
    name: 'Upwork',
    zone: '🌍 Global',
    type: 'Marketplace',
    fees: '10% - 20%',
    fixedFees: 'Commission freelance',
    technicalSetup: '✅ Plateforme fermée',
    targetClients: 'Freelance tech',
    regulation: 'US/EU',
    includedServices: 'Escrow intégré, Disputes, Matching',
  },
  {
    name: 'Fiverr',
    zone: '🌍 Global',
    type: 'Marketplace',
    fees: '20% vendeur + 5% acheteur',
    fixedFees: '= 25% total',
    technicalSetup: '✅ Plateforme fermée',
    targetClients: 'Micro-services',
    regulation: 'US/EU',
    includedServices: 'Escrow intégré, Matching',
  },
  {
    name: 'SwissEscrow',
    zone: '🇨🇭 CH',
    type: 'Technology Escrow',
    fees: 'Sur devis',
    fixedFees: 'Élevé',
    technicalSetup: 'N/A',
    targetClients: 'Software, Code source',
    regulation: 'Swiss',
    includedServices: 'Dépôt logiciel/données',
  },
  {
    name: 'Legibloq',
    zone: '🇫🇷 FR',
    type: 'Blockchain Escrow',
    fees: 'Variable',
    fixedFees: 'Selon contrat',
    technicalSetup: '⚠️ Web3',
    targetClients: 'Crypto, NFT, Immobilier',
    regulation: 'PSAN FR',
    includedServices: 'Smart contracts, Tokenisation',
  },
  {
    name: 'HanseEscrow',
    zone: '🇩🇪 DE',
    type: 'Technology Escrow',
    fees: 'Sur devis',
    fixedFees: 'Élevé',
    technicalSetup: 'N/A',
    targetClients: 'Software, IP',
    regulation: 'German',
    includedServices: 'Dépôt logiciel',
  },
];

const RIVVLOCK_LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjOUI4N0YzIi8+CiAgPHBhdGggZD0iTTggMTJIMjRWMjBIOFYxMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=';

const generatePDF = (): Buffer => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const rivvlockPrimary = '#9B87F3';
  const rivvlockSecondary = '#7E69AB';
  const textPrimary = '#1A1F2C';
  const textSecondary = '#6E59A5';

  // Page 1: Title & Overview
  doc.setFillColor(251, 251, 251);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  try {
    doc.addImage(RIVVLOCK_LOGO_BASE64, 'SVG', margin, margin - 5, 15, 15);
  } catch (e) {
    console.log('Logo not added:', e);
  }

  doc.setFontSize(28);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('RivvLock - Analyse Concurrentielle 2025', pageWidth / 2, margin + 10, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(textSecondary);
  doc.setFont('helvetica', 'normal');
  doc.text('Marchés Suisse, France, Allemagne', pageWidth / 2, margin + 18, { align: 'center' });

  doc.setFillColor(rivvlockPrimary);
  doc.roundedRect(margin, margin + 25, pageWidth - 2 * margin, 25, 3, 3, 'F');

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('15+ Concurrents Analysés', margin + 10, margin + 33);
  doc.text('3 Marchés (CH, FR, DE)', margin + 10, margin + 40);

  doc.text('5% TTC (Stripe inclus)', pageWidth / 2, margin + 33);
  doc.text('Abonnement: Admin + Bilan', pageWidth / 2, margin + 40);

  doc.text('Swiss Compliance (nLPD)', pageWidth - margin - 60, margin + 33);
  doc.text('Setup No-code en 5 min', pageWidth - margin - 60, margin + 40);

  doc.setFontSize(11);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('Positionnement Unique de RivvLock:', margin, margin + 58);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const positioningText = [
    '✅ Plus simple que Mangopay/Lemonway (pas besoin de dev)',
    '✅ Moins cher qu\'Upwork/Fiverr (5% vs 25%)',
    '✅ Plus accessible qu\'Escrow.com (setup en 5 min vs KYC complexe)',
    '✅ Swiss compliance + Modern UX',
  ];

  let yPos = margin + 65;
  positioningText.forEach((line) => {
    doc.text(line, margin + 5, yPos);
    yPos += 6;
  });

  // Page 2: Comparative Table
  doc.addPage('a4', 'landscape');

  doc.setFontSize(18);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('Tableau Comparatif Détaillé', pageWidth / 2, margin, { align: 'center' });

  const tableData = COMPETITORS.map((comp) => [
    comp.name,
    comp.zone,
    comp.type,
    comp.fees,
    comp.fixedFees,
    comp.technicalSetup,
    comp.targetClients,
    comp.regulation,
    comp.includedServices,
  ]);

  autoTable(doc, {
    head: [
      [
        'Concurrent',
        'Zone',
        'Type',
        'Frais (%)',
        'Frais Fixes',
        'Setup Technique',
        'Cible Clientèle',
        'Régulation',
        'Services Inclus',
      ],
    ],
    body: tableData,
    startY: margin + 8,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [155, 135, 243],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      textColor: [26, 31, 44],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 250],
    },
    didParseCell: function (data) {
      if (data.row.index === 0 && data.section === 'body') {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [21, 128, 61];
      }
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 20 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24 },
      4: { cellWidth: 32 },
      5: { cellWidth: 28 },
      6: { cellWidth: 35 },
      7: { cellWidth: 28 },
      8: { cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
  });

  // Page 3: RivvLock Strengths
  doc.addPage('a4', 'landscape');

  doc.setFontSize(18);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('Forces & Différenciateurs RivvLock', pageWidth / 2, margin, { align: 'center' });

  const strengths = [
    {
      title: '💰 Prix Transparent',
      desc: '5% TTC (Stripe inclus)\nAbonnement disponible: Admin + Facturation + Bilan annuel',
      comparison: 'vs Mangopay 1.8% + 2500€ setup\nvs Upwork/Fiverr 25% total',
    },
    {
      title: '⚡ Setup Instantané',
      desc: 'No-code, 5 minutes pour démarrer\nPas de dev, pas d\'intégration technique',
      comparison: 'vs Stripe Connect (dev requis)\nvs Mangopay (intégration complexe)',
    },
    {
      title: '🇨🇭 Swiss Compliance',
      desc: 'Conformité nLPD, RGPD\nDonnées hébergées en Suisse',
      comparison: 'vs Concurrents US/FR\nRassure clients suisses',
    },
    {
      title: '🎯 Multi-cas d\'usage',
      desc: 'Services, Freelance, E-commerce, Biens\nPas limité à une niche',
      comparison: 'vs SwissEscrow (software only)\nvs Tripartie (colis only)',
    },
    {
      title: '⚖️ Disputes Intégrées',
      desc: 'Système de résolution de litiges\nChat intégré, support dédié',
      comparison: 'vs Stripe (pas de disputes)\nvs Escrow.com (basique)',
    },
    {
      title: '📊 Admin & Facturation',
      desc: 'Dashboard complet, factures auto\nAbonnement pour gestion admin',
      comparison: 'vs Marketplaces (pas de contrôle)\nvs PSPs (API only)',
    },
  ];

  let startY = margin + 12;
  const boxWidth = (pageWidth - 3 * margin) / 2;
  const boxHeight = 32;

  strengths.forEach((strength, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + col * (boxWidth + margin);
    const y = startY + row * (boxHeight + 6);

    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');

    doc.setDrawColor(155, 135, 243);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S');

    doc.setFontSize(11);
    doc.setTextColor(textPrimary);
    doc.setFont('helvetica', 'bold');
    doc.text(strength.title, x + 4, y + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(strength.desc, boxWidth - 8);
    doc.text(descLines, x + 4, y + 11);

    doc.setFontSize(7.5);
    doc.setTextColor(textSecondary);
    doc.setFont('helvetica', 'italic');
    const compLines = doc.splitTextToSize(strength.comparison, boxWidth - 8);
    doc.text(compLines, x + 4, y + 22);
  });

  // Page 4: Strategic Recommendations
  doc.addPage('a4', 'landscape');

  doc.setFontSize(18);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommandations Stratégiques pour Fongit', pageWidth / 2, margin, { align: 'center' });

  doc.setFillColor(155, 135, 243);
  doc.roundedRect(margin, margin + 10, pageWidth - 2 * margin, 22, 3, 3, 'F');

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Pitch Positioning:', margin + 10, margin + 18);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(
    '"RivvLock est le Stripe de l\'escrow : moderne, simple, transparent"',
    pageWidth / 2,
    margin + 26,
    { align: 'center' }
  );

  startY = margin + 40;
  doc.setFontSize(13);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('Segments Prioritaires:', margin, startY);

  const segments = [
    {
      title: '1. PME Suisses (Services B2B)',
      args: '• Cherchent sécurité mais pas de dev\n• Budget limité (5% vs 25% Upwork)\n• Compliance suisse importante',
    },
    {
      title: '2. Freelances & Agences',
      args: '• Besoin de facturation pro\n• Protection disputes essentielle\n• Simplicité > fonctionnalités',
    },
    {
      title: '3. Petites Marketplaces',
      args: '• Pas de budget dev (vs Mangopay)\n• Besoin escrow sans complexité\n• Setup rapide critique',
    },
  ];

  startY += 8;
  segments.forEach((seg) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textSecondary);
    doc.text(seg.title, margin + 5, startY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const argLines = seg.args.split('\n');
    startY += 6;
    argLines.forEach((line) => {
      doc.text(line, margin + 10, startY);
      startY += 5;
    });
    startY += 3;
  });

  startY += 5;
  doc.setFontSize(13);
  doc.setTextColor(textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text('Arguments Commerciaux par Concurrent:', margin, startY);

  const competitorArgs = [
    {
      vs: 'vs Mangopay/Lemonway',
      arg: '"Même qualité d\'escrow, mais sans avoir besoin d\'une équipe dev"',
    },
    {
      vs: 'vs Upwork/Fiverr',
      arg: '"Gardez 95% de vos revenus au lieu de 75%, avec vos propres clients"',
    },
    {
      vs: 'vs Escrow.com',
      arg: '"Setup en 5 min vs 2 semaines de KYC, tarifs transparents"',
    },
    {
      vs: 'vs Stripe Connect',
      arg: '"Escrow clé en main, pas besoin de coder votre propre système"',
    },
  ];

  startY += 8;
  competitorArgs.forEach((arg) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rivvlockSecondary);
    doc.text(arg.vs, margin + 5, startY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(60, 60, 60);
    doc.text(arg.arg, margin + 10, startY + 5);

    startY += 12;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `RivvLock - Analyse Concurrentielle 2025 | Page ${i}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
    doc.text(
      'Généré le ' + new Date().toLocaleDateString('fr-FR'),
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
};

// Generate and save PDF
const pdfBuffer = generatePDF();
const outputPath = path.join(process.cwd(), 'public', 'RivvLock_Analyse_Concurrentielle_2025.pdf');

// Ensure public directory exists
if (!fs.existsSync(path.dirname(outputPath))) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

fs.writeFileSync(outputPath, pdfBuffer);
console.log('✅ PDF generated successfully at:', outputPath);
