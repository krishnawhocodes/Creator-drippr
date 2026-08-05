import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllCreators } from "@/lib/api";
import { formatDate } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Search } from "lucide-react";
import type { CreatorProfile } from "@/types";

type Tab = "all" | "submitted" | "approved" | "rejected" | "pending";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function CreatorList() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    fetchAllCreators()
      .then((data) => setCreators(data.creators || []))
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = creators.filter((c) => {
    if (tab !== "all" && c.verificationStatus !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.affiliateCode || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts: Record<Tab, number> = {
    all: creators.length,
    submitted: creators.filter((c) => c.verificationStatus === "submitted").length,
    approved: creators.filter((c) => c.verificationStatus === "approved").length,
    rejected: creators.filter((c) => c.verificationStatus === "rejected").length,
    pending: creators.filter((c) => c.verificationStatus === "pending").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creators</h1>
        <p className="text-muted-foreground">
          Manage and verify creator accounts.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
      >
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="submitted">Submitted ({counts.submitted})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creator Accounts</CardTitle>
          <CardDescription>
            {filtered.length} creator{filtered.length !== 1 ? "s" : ""} found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !filtered.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No creators found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.uid}>
                      <TableCell className="font-medium">
                        {c.fullName}
                      </TableCell>
                      <TableCell className="text-sm">{c.email}</TableCell>
                      <TableCell>{c.platform || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {c.affiliateCode || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[c.verificationStatus]}>
                          {c.verificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            navigate(`/admin/creator/${c.uid}`)
                          }
                        >
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
