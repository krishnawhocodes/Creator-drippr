import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAnalytics } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, IndianRupee, TrendingUp } from "lucide-react";
import type { AffiliateAnalytics } from "@/types";

export default function Analytics() {
  const { profile } = useAuth();
  const [data, setData] = useState<AffiliateAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.affiliateCode) {
      setLoading(false);
      return;
    }
    fetchAnalytics(profile.affiliateCode)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profile?.affiliateCode]);

  if (!profile?.affiliateCode) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No affiliate code yet</p>
            <p className="text-sm text-muted-foreground">
              Complete verification to get your affiliate code and start
              tracking sales.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Track orders and revenue from your affiliate code{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold">
            {profile.affiliateCode}
          </code>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">
                  {data?.totalOrders ?? 0}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-primary/10 p-3">
              <IndianRupee className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-3xl font-bold">
                  {formatCurrency(data?.totalRevenue ?? 0)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            Orders placed using your affiliate code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !data?.orders.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No orders yet. Share your code to start earning!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-mono text-sm">
                        #{order.orderNumber}
                      </TableCell>
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{order.itemCount}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(
                          parseFloat(order.totalPrice),
                          order.currencyCode,
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {order.financialStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
