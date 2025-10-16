import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Button,
  Img,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface TransactionCreatedProps {
  sellerName: string;
  transactionTitle: string;
  amount: number;
  currency: string;
  serviceDate: string;
  paymentDeadline: string;
  shareLink: string;
}

export const TransactionCreatedEmail = ({
  sellerName,
  transactionTitle,
  amount,
  currency,
  serviceDate,
  paymentDeadline,
  shareLink,
}: TransactionCreatedProps) => (
  <Html>
    <Head />
    <Preview>Nouvelle transaction RivvLock : {transactionTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img 
            src="https://app.rivvlock.com/assets/rivvlock-logo-email.png"
            alt="RIVVLOCK"
            width="200"
            style={logoImage}
          />
          <Text style={tagline}>Tiers de confiance pour transactions sécurisées</Text>
        </Section>

        <Heading style={h1}>Nouvelle transaction en attente</Heading>
        
        <Text style={text}>
          Bonjour,
        </Text>
        
        <Text style={text}>
          <strong>{sellerName}</strong> vous invite à effectuer le règlement via une transaction sécurisée sur RivvLock.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>📋 Détails de la transaction</Text>
          <Hr style={separator} />
          <Text style={detailsItem}>
            <strong>Service :</strong> {transactionTitle}
          </Text>
          <Text style={detailsItem}>
            <strong>Montant :</strong> {amount.toFixed(2)} {currency}
          </Text>
          <Text style={detailsItem}>
            <strong>Date du service :</strong> {serviceDate}
          </Text>
          <Text style={detailsItem}>
            <strong>⏰ À payer avant :</strong> <span style={deadline}>{paymentDeadline}</span>
          </Text>
        </Section>

        <Section style={ctaSection}>
          <Button href={shareLink} style={button}>
            ✅ Voir et payer la transaction
          </Button>
        </Section>

        <Text style={text}>
          Ou copiez ce lien dans votre navigateur :
        </Text>
        <Text style={linkText}>
          <Link href={shareLink} style={link}>
            {shareLink}
          </Link>
        </Text>

        <Hr style={separator} />

        <Section style={infoBox}>
          <Text style={infoTitle}>🔐 Pourquoi RivvLock ?</Text>
          <Text style={infoText}>
            Vos fonds sont <strong>bloqués en sécurité</strong> jusqu'à la réalisation du service.
            Le prestataire ne reçoit le paiement qu'après votre validation.
          </Text>
        </Section>

        <Hr style={separator} />

        <Text style={footer}>
          <Link href="https://app.rivvlock.com" style={footerLink}>
            RivvLock
          </Link>
          {' '}- Tiers de confiance pour transactions sécurisées
        </Text>

        <Text style={footerSmall}>
          Vous recevez cet email car une transaction a été créée pour vous.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default TransactionCreatedEmail;

// Styles
const main = {
  backgroundColor: '#F7F7F7',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 20px 20px',
  textAlign: 'center' as const,
  backgroundColor: '#ffffff',
  borderBottom: '3px solid #007BFF',
};

const logoImage = {
  margin: '0 auto 16px',
  display: 'block',
};

const tagline = {
  color: '#484848',
  fontSize: '14px',
  margin: '0',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 20px 24px',
  padding: '0',
};

const text = {
  color: '#484848',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 20px',
};

const detailsBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '20px',
};

const detailsTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const detailsItem = {
  color: '#484848',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const deadline = {
  color: '#dc2626',
  fontWeight: 'bold',
};

const separator = {
  borderColor: '#e5e7eb',
  margin: '16px 0',
};

const ctaSection = {
  margin: '32px 20px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#007BFF',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
};

const linkText = {
  color: '#007BFF',
  fontSize: '14px',
  margin: '8px 20px',
  wordBreak: 'break-all' as const,
};

const link = {
  color: '#007BFF',
  textDecoration: 'underline',
};

const infoBox = {
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '16px',
};

const infoTitle = {
  color: '#1e40af',
  fontSize: '15px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const infoText = {
  color: '#1e3a8a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 20px 8px',
  textAlign: 'center' as const,
};

const footerLink = {
  color: '#007BFF',
  textDecoration: 'underline',
};

const footerSmall = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 20px',
  textAlign: 'center' as const,
};
