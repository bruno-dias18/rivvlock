import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Eye, AlertTriangle } from 'lucide-react';

export const Security = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Sécurité</h1>
          <p className="text-muted-foreground mt-1">
            Informations sur la sécurité et la protection de vos données.
          </p>
        </div>

        {/* Security Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="p-2 rounded-lg bg-green-100 mr-4">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Chiffrement
                </p>
                <p className="text-lg font-bold text-green-600">
                  SSL/TLS
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="p-2 rounded-lg bg-blue-100 mr-4">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Authentification
                </p>
                <p className="text-lg font-bold text-blue-600">
                  Sécurisée
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="p-2 rounded-lg bg-purple-100 mr-4">
                <Eye className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Base de données
                </p>
                <p className="text-lg font-bold text-purple-600">
                  Protégée
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Fonctionnalités de sécurité
            </CardTitle>
            <CardDescription>
              Mesures de protection mise en place pour sécuriser vos transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="p-1 rounded bg-green-100">
                <Shield className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Chiffrement des données</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Toutes les données sensibles sont chiffrées en transit et au repos avec des algorithmes de pointe.
                </p>
                <Badge className="mt-2 bg-green-100 text-green-700">Actif</Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="p-1 rounded bg-blue-100">
                <Lock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Authentification sécurisée</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Système d'authentification robuste avec validation par email et protection contre les attaques.
                </p>
                <Badge className="mt-2 bg-blue-100 text-blue-700">Actif</Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="p-1 rounded bg-purple-100">
                <Eye className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Contrôle d'accès granulaire</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Row Level Security (RLS) pour garantir que chaque utilisateur n'accède qu'à ses propres données.
                </p>
                <Badge className="mt-2 bg-purple-100 text-purple-700">Actif</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle>Bonnes pratiques</CardTitle>
            <CardDescription>
              Recommandations pour maintenir la sécurité de votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Utilisez un mot de passe fort et unique</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Ne partagez jamais vos informations de connexion</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Vérifiez régulièrement l'activité de votre compte</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Déconnectez-vous des appareils partagés</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};