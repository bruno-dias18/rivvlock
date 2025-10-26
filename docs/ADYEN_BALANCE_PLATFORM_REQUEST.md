# Template Email - Demande d'accès Adyen Balance Platform

---

**Objet:** Demande d'accès Balance Platform pour RivvLock (Test + Production)

---

Bonjour [Nom Account Manager Adyen],

J'espère que vous allez bien.

Je vous contacte concernant notre plateforme **RivvLock** (marketplace B2B de transactions sécurisées) actuellement hébergée sur votre solution Adyen Checkout en mode test.

Nous souhaitons évoluer vers **Adyen Balance Platform** pour automatiser notre gestion des paiements escrow et des virements aux vendeurs.

## 📊 Contexte actuel

- **Produit** : Marketplace B2B (transactions sécurisées entre professionnels)
- **Setup actuel** : Adyen Checkout (test environment)
- **Volume projeté** : 
  - Phase 1 (3 mois) : CHF 50'000-100'000/mois
  - Phase 2 (6 mois) : CHF 200'000-500'000/mois
- **Nombre de vendeurs** : 10-20 actifs (phase 1), 50-100 (phase 2)
- **Cas d'usage** : Escrow (capture → hold → release vers vendeur)

## 🎯 Objectifs Balance Platform

1. **Automatisation des paiements** : Virements automatiques vers vendeurs après validation
2. **Conformité KYC/AML** : Délégation de la vérification vendeurs à Adyen
3. **Comptabilité simplifiée** : Split automatique (95% vendeur / 5% plateforme)
4. **Scaling** : Préparer la croissance internationale (CH, FR, DE)

## 🔍 Demande spécifique

Pourriez-vous nous **donner accès au test environment Balance Platform** afin que nous puissions :
- Tester l'onboarding vendeur (KYC)
- Implémenter les transfers API
- Valider l'architecture technique avant la production

## 📅 Timeline souhaitée

- **Maintenant** : Accès test environment + documentation
- **Semaine 2-4** : Implémentation et tests
- **Semaine 6-8** : Validation et passage en production

## 📞 Coordonnées

- **Nom** : [Votre nom]
- **Entreprise** : RivvLock
- **Email** : [Votre email]
- **Merchant Account actuel** : [Votre ADYEN_MERCHANT_ACCOUNT]

Merci d'avance pour votre retour. N'hésitez pas si vous avez besoin d'informations complémentaires sur notre business model ou architecture technique.

Cordialement,  
[Votre nom]  
[Votre titre]  
RivvLock

---

## 📝 Notes internes (ne pas inclure dans l'email)

**Informations à préparer si demandées par Adyen** :

1. **Business case détaillé** :
   - Secteur : B2B services (freelance, consulting, artisans)
   - Flow : Acheteur paie → RivvLock hold → Vendeur livre → Release funds
   - Commission : 5% sur chaque transaction

2. **Volumes prévisionnels** :
   - Ticket moyen : CHF 500-2'000
   - Transactions/mois : 50-100 (phase 1)
   - Taux de conversion : 15-20%

3. **Technical stack** :
   - Frontend : React + TypeScript
   - Backend : Supabase Edge Functions (Deno)
   - Hosting : Supabase Cloud (AWS Frankfurt)

4. **Compliance** :
   - Système KYC manuel déjà implémenté
   - Conservation documents 10 ans (LBA Suisse)
   - Limites actuelles : CHF 1'000/transaction sans KYC vérifié

5. **Alternatives considérées** :
   - Stripe Connect (coûts plus élevés)
   - Solution in-house + SEPA (complexité opérationnelle)
   - Raison du choix Adyen : Fees compétitifs + Support EU + KYC intégré
