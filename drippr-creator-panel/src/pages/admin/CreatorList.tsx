import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCreators } from "@/lib/adminDb";
import { formatDate } from "@/lib/utils";
import { getPlatforms, summarisePlatforms } from "@/lib/platforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Search, Users, AlertCircle, Download } from "lucide-react";
import type { CreatorProfile } from "@/types";

type Tab = "all" | "submitted" | "approved" | "rejected" | "pending";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  submitted: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
};

export default function CreatorList() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    listCreators()
      .then(setCreators)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load creators."),
      )
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      all: creators.length,
      submitted: creators.filter((c) => c.verificationStatus === "submitted")
        .length,
      approved: creators.filter((c) => c.verificationStatus === "approved")
        .length,
      rejected: creators.filter((c) => c.verificationStatus === "rejected")
        .length,
      pending: creators.filter((c) => c.verificationStatus === "pending").length,
    }),
    [creators],
  );

  const filtered = useMemo(() => {
    return creators.filter((c) => {
      if (tab !== "all" && c.verificationStatus !== tab) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (c.fullName || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.affiliateCode || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
      );
    });
  }, [creators, tab, search]);

  function exportCsv() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Platform",
      "Followers",
      "Affiliate Code",
      "Status",
      "Joined",
    ];
    const rows = filtered.map((c) => {
      const ps = getPlatforms(c);
      return [
        c.fullName,
        c.email,
        c.phone,
        ps.map((p) => `${p.platform}:${p.handle}`).join(" | "),
        ps.map((p) => p.followerCount).join(" | "),
        c.affiliateCode || "",
        c.verificationStatus,
        new Date(c.createdAt).toISOString().slice(0, 10),
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drippr-creators-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Creators</h1>
          <p className="text-sm text-gray-500">
            All registered creators and their verification status.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="submitted">
            Submitted ({counts.submitted})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({counts.approved})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({counts.rejected})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search name, email, phone, or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filtered.length} creator{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="rounded-full bg-gray-100 p-3">
                <Users className="h-5 w-5 text-gray-400" />
              </div>
              <p className="font-medium text-gray-700">No creators found</p>
              <p className="text-sm text-gray-500">
                Try a different search or filter.
              </p>
            </div>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.uid}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/creator/${c.uid}`)}
                    >
                      <TableCell className="font-medium">
                        {c.fullName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {c.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {summarisePlatforms(getPlatforms(c))}
                      </TableCell>
                      <TableCell>
                        {c.affiliateCode ? (
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                            {c.affiliateCode}
                          </code>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[c.verificationStatus]}>
                          {c.verificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
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
