# Comptabilité Adyen - Guide complet

## 📊 Vue d'ensemble

Ce système permet de **séparer clairement** :
- **Argent en transit** (95% dû aux vendeurs)
- **Votre commission brute** (5% du montant capturé)
- **Votre revenu net** (commission - frais processeur Adyen)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Acheteur paie 100 CHF                                      │
│  ├─ Adyen capture → Votre compte Adyen                      │
│  │                                                           │
│  ├─ Base de données (adyen_payouts) enregistre :           │
│  │   - Montant brut : 100.00 CHF                            │
│  │   - Commission plateforme : 5.00 CHF                     │
│  │   - Montant vendeur : 95.00 CHF                          │
│  │   - Frais estimés Adyen : ~1.40 CHF                      │
│  │   - Votre revenu net : 3.60 CHF                          │
│  │   - Statut : "pending"                                   │
│  │                                                           │
│  ├─ Vous virez 95 CHF au vendeur (manuel/SEPA)             │
│  │   - Marquer statut : "sent"                              │
│  │                                                           │
│  └─ Après confirmation bancaire                             │
│      - Marquer statut : "completed"                         │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Tables de données

### `adyen_payout_accounts`
Comptes bancaires des vendeurs (IBAN, BIC, nom titulaire).

**Champs clés** :
- `user_id` : ID du vendeur
- `iban` : IBAN du compte bancaire
- `account_holder_name` : Nom du titulaire
- `verified` : ✅ Vérifié par admin / ⏳ En attente
- `is_default` : Compte par défaut (un seul par vendeur)

### `adyen_payouts`
Traçabilité de chaque paiement vendeur.

**Champs clés** :
- `transaction_id` : Lien vers la transaction RivvLock
- `seller_id` : ID du vendeur
- `gross_amount` : Montant capturé (en centimes)
- `seller_amount` : Montant à virer au vendeur (95%)
- `platform_commission` : Commission brute (5%)
- `estimated_processor_fees` : Frais Adyen estimés
- `net_platform_revenue` : Votre revenu net
- `status` : `pending` | `sent` | `completed` | `failed`
- `iban_destination` : IBAN du vendeur
- `batch_reference` : Référence du fichier SEPA (optionnel)

## 🔄 Workflow complet

### 1️⃣ Acheteur paie (Adyen capture)
Lors de la release des fonds (`release-funds-adyen`), le système :
1. Capture le paiement auprès d'Adyen
2. Récupère l'IBAN vérifié du vendeur
3. Crée une entrée dans `adyen_payouts` avec :
   - Montants calculés (95% vendeur, 5% commission)
   - IBAN destination
   - Statut `pending`

### 2️⃣ Vous effectuez le virement
**Deux options** :

#### Option A : Manuel (petits volumes)
1. Aller sur le dashboard admin `/admin/payouts`
2. Voir la liste des paiements `pending`
3. Faire le virement SEPA manuellement depuis votre banque
4. Marquer comme `sent` dans RivvLock

#### Option B : Automatisé SEPA (scaling)
1. Dashboard admin `/admin/payouts`
2. Sélectionner plusieurs paiements
3. Cliquer "Exporter virements SEPA"
4. Upload du fichier XML/JSON dans votre banque
5. Marquer comme `sent` en batch

### 3️⃣ Confirmation bancaire
Une fois le virement reçu par le vendeur :
- Marquer le payout comme `completed`
- Le vendeur voit "✅ Payé" dans son interface

## 💰 Calcul des montants

### Exemple : Transaction de 1'000 CHF

```
Montant capturé :           1'000.00 CHF  (100%)
├─ Commission plateforme :     50.00 CHF  (5%)
├─ Montant vendeur :          950.00 CHF  (95%)
└─ Frais Adyen estimés :       14.25 CHF  (~1.425%)

Votre revenu net :             35.75 CHF  (50 - 14.25)
```

**Formule** :
```
net_platform_revenue = platform_commission - processor_fees
                     = (gross * 5%) - (gross * 1.425%)
                     = gross * 3.575%
```

## 📈 Dashboard comptable

### Vue d'ensemble (`/admin/payouts`)

```
┌─────────────────────────────────────────────────────────┐
│ 💰 Solde comptable Adyen                                │
├─────────────────────────────────────────────────────────┤
│ Total capturé :           125'000 CHF                   │
│ Dû aux vendeurs :         118'750 CHF  (95%)            │
│ Commission brute :          6'250 CHF  (5%)             │
│ Frais processeur :          1'781 CHF  (~1.425%)        │
│ Revenu net :                4'469 CHF  (~3.58%)         │
│                                                         │
│ ⚠️ Paiements en attente :  15'200 CHF                   │
│    (16 paiements pending)                               │
└─────────────────────────────────────────────────────────┘
```

**SQL pour obtenir ces chiffres** :
```sql
SELECT * FROM get_adyen_accounting_summary();
```

## 🔒 Sécurité et conformité

### ✅ Conformité légale (Suisse)
- ✅ Séparation comptable claire (transit vs commission)
- ✅ Traçabilité 100% des paiements (audit trail)
- ✅ Conservation 10 ans (GDPR/nLPD)
- ✅ Paiement vendeurs sous 30 jours (Code des Obligations)

### 🔐 Sécurité données
- IBAN jamais exposé en entier dans logs (masqué : CH93****1234)
- RLS Policies : Vendeurs voient leurs payouts uniquement
- Admins accès full avec audit trail

## 📊 Rapports pour comptabilité

### Export mensuel
Dashboard admin → Filtrer par mois → "Exporter CSV"

**Colonnes CSV** :
- Date transaction
- ID transaction
- Vendeur (nom/company)
- Montant brut
- Commission plateforme
- Frais processeur
- Revenu net
- IBAN destination
- Statut paiement
- Date virement

### Déclaration fiscale
Votre comptable/fisc a besoin de :
1. **Chiffre d'affaires** = `SUM(gross_amount)` (montants capturés)
2. **Commissions perçues** = `SUM(platform_commission)`
3. **Coûts d'exploitation** = `SUM(estimated_processor_fees)`
4. **Revenu net imposable** = `SUM(net_platform_revenue)`

## 🚀 Évolution vers Adyen for Platforms

**Quand migrer ?** :
- Volume > CHF 100'000/mois
- > 50 vendeurs actifs
- Validation manuelle KYC prend > 2h/jour

**Avantages** :
- ✅ KYC automatique (Adyen fait la vérification)
- ✅ Virements automatiques (API Transfer)
- ✅ Split automatique (pas de comptabilité manuelle)
- ✅ Multi-devises natif (CHF, EUR, USD)

**Coûts supplémentaires estimés** :
- Adyen for Platforms : +0.5% par transaction
- Setup fee : ~CHF 5'000 one-time
- KYC vendeurs : inclus (vs CHF 5/vendeur si API externe)

## 🛠️ Maintenance

### Tâches quotidiennes
- [ ] Vérifier paiements `pending` (dashboard admin)
- [ ] Effectuer virements SEPA
- [ ] Marquer virements comme `sent`

### Tâches hebdomadaires
- [ ] Vérifier confirmations bancaires
- [ ] Marquer virements comme `completed`
- [ ] Export comptable pour comptable

### Tâches mensuelles
- [ ] Rapprochement bancaire (compte Adyen vs DB)
- [ ] Export fiscal pour déclaration TVA
- [ ] Vérifier cohérence (total captured = payouts + net revenue)

## 🆘 FAQ

### Que faire si un virement échoue ?
1. Marquer le payout comme `failed` avec notes admin
2. Contacter le vendeur pour vérifier IBAN
3. Créer un nouveau payout avec bon IBAN
4. Rembourser frais bancaires si nécessaire

### Comment gérer les remboursements ?
Les remboursements (refunds) sont gérés séparément via Adyen API.
Ils n'affectent PAS les entrées `adyen_payouts` (qui sont figées).

### Différence entre `sent` et `completed` ?
- **`sent`** : Vous avez envoyé le virement (API SEPA ou manuel)
- **`completed`** : Le vendeur a confirmé réception (ou banque confirme)

### Puis-je modifier un payout après création ?
❌ Non, les montants sont immutables (audit trail).
Seuls statut et notes admin peuvent être modifiés.
