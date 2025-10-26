# Template Email - Demande d'accès Adyen Balance Platform

---

**À:** support@adyen.com  
**Objet:** Request Balance Platform Test Environment - RivvLock Marketplace

---

Bonjour,

Je vous contacte concernant notre plateforme **RivvLock**, une marketplace B2B de transactions sécurisées (escrow) actuellement hébergée sur votre solution Adyen en mode test.

**Merchant Account actuel :** [Remplacer par ton ADYEN_MERCHANT_ACCOUNT]

## 🎯 Contexte et objectif

Nous développons une plateforme d'escrow pour professionnels en Suisse (freelances, artisans, PME). Notre système capture les paiements via Adyen, les retient en escrow, puis les libère au vendeur après validation de la prestation.

Nous souhaitons **tester Balance Platform en environnement sandbox** afin d'automatiser nos virements vendeurs et déléguer le KYC/AML.

## 📊 Informations business

- **Secteur** : Marketplace B2B (escrow payments)
- **Pays** : Suisse, France, Allemagne
- **Status** : Beta privée (5-10 testeurs, lancement prévu mi-2026)
- **Volume projeté** :
  - Phase 1 (3 mois) : CHF 50'000-100'000/mois
  - Phase 2 (6 mois) : CHF 200'000-500'000/mois
- **Nombre de vendeurs** : 10-20 actifs (phase 1), 50-100 (phase 2)
- **Ticket moyen** : CHF 500-2'000

## 🔧 Use case technique

Nous avons déjà implémenté :
- ✅ Capture Adyen (payments API)
- ✅ Delayed capture (escrow hold 7-30 jours)
- ✅ KYC manuel (conforme LBA Suisse)
- ✅ Virements SEPA manuels

**Ce que Balance Platform nous apporterait** :
1. Automatisation des virements vendeurs (Transfers API)
2. KYC vendeurs délégué à Adyen (Legal Entity API)
3. Split automatique 95% vendeur / 5% plateforme
4. Scaling international (multi-devises)

## 🙏 Demande spécifique

Pourriez-vous **activer Balance Platform sur notre compte test** (TEST environment) afin que nous puissions :
- Tester l'onboarding vendeur (Account Holders API)
- Implémenter les transfers (Transfers API)
- Valider l'architecture avant go-live production

**Timeline souhaitée** :
- Semaine 1-2 : Tests et intégration API
- Semaine 4-6 : Validation business case
- Mois 3-6 : Go-live production (selon volumes)

## 📞 Coordonnées

- **Nom** : Bruno Dias
- **Entreprise** : RivvLock
- **Email** : [Ton email]
- **Téléphone** : [Ton téléphone]
- **Merchant Account** : [Ton ADYEN_MERCHANT_ACCOUNT]

Merci d'avance pour votre retour. Je reste disponible pour toute information complémentaire sur notre business model ou architecture technique.

Cordialement,  
Bruno Dias  
Founder - RivvLock

---

## 📝 Annexe (si demandée)

**Stack technique** :
- Frontend : React + TypeScript (Lovable)
- Backend : Supabase Edge Functions (Deno)
- Hosting : AWS Frankfurt (GDPR compliant)
- Intégration Adyen actuelle : Checkout API + Payments API

**Compliance** :
- KYC manuel opérationnel
- Conservation documents 10 ans (LBA Suisse)
- RLS policies (Row Level Security)
- Limite CHF 1'000/transaction sans KYC vérifié

---

**Alternative** : Si vous préférez un échange téléphonique, je suis disponible aux horaires suivants : [Propose 2-3 créneaux]
