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

interface PaymentReminderProps {
  urgencyLevel: '72h' | '24h' | '12h' | '2h';
  transactionTitle: string;
  amount: number;
  currency: string;
  hoursRemaining: number;
  paymentDeadline: string;
  shareLink: string;
}

const getUrgencyConfig = (level: string) => {
  const configs: Record<string, { emoji: string; title: string; color: string; bgColor: string }> = {
    '72h': {
      emoji: '⏰',
      title: 'Rappel : Votre paiement',
      color: '#007BFF',
      bgColor: '#eff6ff',
    },
    '24h': {
      emoji: '🚨',
      title: 'IMPORTANT : Plus que 24h',
      color: '#c2410c',
      bgColor: '#fff7ed',
    },
    '12h': {
      emoji: '🚨',
      title: 'URGENT : Dernières 12h',
      color: '#dc2626',
      bgColor: '#fef2f2',
    },
    '2h': {
      emoji: '⚠️',
      title: 'DERNIÈRE CHANCE : Expiration dans 2h',
      color: '#991b1b',
      bgColor: '#fee2e2',
    },
  };
  return configs[level] || configs['72h'];
};

export const PaymentReminderEmail = ({
  urgencyLevel,
  transactionTitle,
  amount,
  currency,
  hoursRemaining,
  paymentDeadline,
  shareLink,
}: PaymentReminderProps) => {
  const config = getUrgencyConfig(urgencyLevel);

  return (
    <Html>
      <Head />
      <Preview>{config.emoji} Rappel de paiement : {transactionTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img 
              src="https://app.rivvlock.com/assets/rivvlock-logo-email.png"
              alt="RIVVLOCK"
              width="200"
              style={logoImage}
            />
            <Text style={tagline}>Paiements sécurisés pour services</Text>
          </Section>

          <Section style={{ ...urgentBanner, backgroundColor: config.bgColor }}>
            <Text style={{ ...urgentText, color: config.color }}>
              {config.emoji} {config.title}
            </Text>
          </Section>

          <Heading style={h1}>Transaction en attente de paiement</Heading>
          
          <Text style={text}>
            Bonjour,
          </Text>
          
          <Text style={text}>
            Vous avez reçu une invitation à effectuer un règlement via RivvLock, mais le paiement n'a pas encore été effectué.
          </Text>

          <Section style={{ ...timeBox, borderColor: config.color }}>
            <Text style={{ ...timeText, color: config.color }}>
              ⏳ <strong>Temps restant : {hoursRemaining}h</strong>
            </Text>
            <Text style={{ ...timeDeadline, color: config.color }}>
              Expiration : {paymentDeadline}
            </Text>
          </Section>

          <Section style={detailsBox}>
            <Text style={detailsTitle}>📋 Détails de la transaction</Text>
            <Hr style={separator} />
            <Text style={detailsItem}>
              <strong>Service :</strong> {transactionTitle}
            </Text>
            <Text style={detailsItem}>
              <strong>Montant :</strong> {amount.toFixed(2)} {currency}
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button href={shareLink} style={{ ...button, backgroundColor: config.color }}>
              💳 Payer maintenant
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

          <Section style={warningBox}>
            <Text style={warningTitle}>⚠️ Attention</Text>
            <Text style={warningText}>
              Sans paiement avant la date limite, <strong>la transaction expirera automatiquement</strong> et
              vous ne pourrez plus bénéficier du service.
            </Text>
          </Section>

          <Hr style={separator} />

          <Text style={footer}>
            <Link href="https://app.rivvlock.com" style={footerLink}>
              RivvLock
            </Link>
            {' '}- Paiements sécurisés pour services
          </Text>

          <Text style={footerSmall}>
            Vous recevez cet email car vous avez une transaction en attente.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default PaymentReminderEmail;

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

const urgentBanner = {
  padding: '16px 20px',
  margin: '0',
  textAlign: 'center' as const,
};

const urgentText = {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
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

const timeBox = {
  border: '2px solid',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '20px',
  textAlign: 'center' as const,
};

const timeText = {
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const timeDeadline = {
  fontSize: '15px',
  margin: '0',
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

const separator = {
  borderColor: '#e5e7eb',
  margin: '16px 0',
};

const ctaSection = {
  margin: '32px 20px',
  textAlign: 'center' as const,
};

const button = {
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

const warningBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: '8px',
  margin: '24px 20px',
  padding: '16px',
};

const warningTitle = {
  color: '#dc2626',
  fontSize: '15px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const warningText = {
  color: '#991b1b',
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
