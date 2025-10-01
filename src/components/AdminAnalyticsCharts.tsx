import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface AdminAnalyticsChartsProps {
  analytics: {
    timeSeries: Array<{ date: string; transactions: number; users: number; volume: number }>;
    statusDistribution: Array<{ status: string; count: number; percentage: number }>;
    currencyVolumes: Array<{ currency: string; volume: number; count: number }>;
  } | undefined;
  isLoading: boolean;
}

export const AdminAnalyticsCharts = ({ analytics, isLoading }: AdminAnalyticsChartsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <Tabs defaultValue="timeline" className="space-y-4">
      <TabsList className="w-full">
        <TabsTrigger value="timeline" className="flex-1">Évolution</TabsTrigger>
        <TabsTrigger value="status" className="flex-1">Statuts</TabsTrigger>
        <TabsTrigger value="currency" className="flex-1">Devises</TabsTrigger>
      </TabsList>

      <TabsContent value="timeline" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Évolution des Transactions</CardTitle>
            <CardDescription>Nombre de transactions par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="transactions" 
                  stroke="hsl(var(--primary))" 
                  name="Transactions"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--secondary))" 
                  name="Nouveaux utilisateurs"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume des Transactions</CardTitle>
            <CardDescription>Volume total par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="status">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par Statut</CardTitle>
            <CardDescription>Distribution des transactions par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={analytics.statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percentage }) => `${status}: ${percentage.toFixed(1)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="status"
                >
                  {analytics.statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="currency">
        <Card>
          <CardHeader>
            <CardTitle>Volume par Devise</CardTitle>
            <CardDescription>Répartition du volume par devise</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={analytics.currencyVolumes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="currency" type="category" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume" />
                <Bar dataKey="count" fill="hsl(var(--secondary))" name="Nombre" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
