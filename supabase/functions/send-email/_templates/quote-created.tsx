import React from "npm:react@18.3.1";

interface QuoteCreatedEmailProps {
  clientName: string;
  sellerName: string;
  quoteTitle: string;
  quoteLink: string;
  totalAmount: string;
  currency: string;
  validUntil: string;
}

export const QuoteCreatedEmail = ({
  clientName,
  sellerName,
  quoteTitle,
  quoteLink,
  totalAmount,
  currency,
  validUntil
}: QuoteCreatedEmailProps) => (
  <html>
    <head>
      <style>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
        }
        .quote-info {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 25px 0;
        }
        .quote-info h2 {
          margin: 0 0 15px 0;
          font-size: 20px;
          color: #667eea;
        }
        .quote-detail {
          margin: 10px 0;
          font-size: 15px;
        }
        .quote-detail strong {
          color: #555;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 16px 40px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          margin: 25px 0;
          text-align: center;
        }
        .footer {
          background: #f8f9fa;
          padding: 25px 30px;
          text-align: center;
          font-size: 13px;
          color: #666;
          border-top: 1px solid #e0e0e0;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>📋 Nouveau Devis RivvLock</h1>
        </div>
        
        <div className="content">
          <p className="greeting">Bonjour {clientName},</p>
          
          <p>
            <strong>{sellerName}</strong> vous a envoyé un devis sécurisé via RivvLock.
          </p>
          
          <div className="quote-info">
            <h2>{quoteTitle}</h2>
            <div className="quote-detail">
              <strong>Montant total :</strong> {totalAmount} {currency.toUpperCase()}
            </div>
            <div className="quote-detail">
              <strong>Valide jusqu'au :</strong> {validUntil}
            </div>
          </div>
          
          <p>
            Cliquez sur le bouton ci-dessous pour consulter votre devis détaillé. 
            Vous pourrez ensuite accepter, négocier ou refuser ce devis en toute sécurité.
          </p>
          
          <center>
            <a href={quoteLink} className="cta-button">
              Consulter mon devis
            </a>
          </center>
          
          <p style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
            Ce lien est personnel et sécurisé. Ne le partagez avec personne.
          </p>
        </div>
        
        <div className="footer">
          <p>
            Ce devis a été envoyé via <a href="https://rivvlock.com">RivvLock</a>, 
            la plateforme de transactions sécurisées entre professionnels et particuliers.
          </p>
          <p style={{ marginTop: '10px' }}>
            Vous avez des questions ? <a href="https://rivvlock.com/contact">Contactez-nous</a>
          </p>
        </div>
      </div>
    </body>
  </html>
);
