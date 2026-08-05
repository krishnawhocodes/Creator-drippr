import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
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
import { CreditCard, IndianRupee } from "lucide-react";
import type { PaymentRecord } from "@/types";

export default function Payments() {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "payments"),
      where("creatorUid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    getDocs(q)
      .then((snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord)));
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [user]);

  const totalEarned = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  if (!profile?.affiliateCode) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">Not available yet</p>
            <p className="text-sm text-muted-foreground">
              Complete verification to start earning and receiving payments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">Track your payouts and earnings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-green-100 p-3">
              <IndianRupee className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-3xl font-bold">
                  {formatCurrency(totalEarned)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-yellow-100 p-3">
              <CreditCard className="h-6 w-6 text-yellow-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payout</p>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-3xl font-bold">
                  {formatCurrency(totalPending)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All your past and pending payouts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !payments.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payments yet. Payments will appear here once processed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.reference}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[p.status]}>
                          {p.status}
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
