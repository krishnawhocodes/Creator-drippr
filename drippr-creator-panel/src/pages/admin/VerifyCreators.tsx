import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCreators } from "@/lib/adminDb";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck,
  ExternalLink,
  FileText,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { CreatorProfile } from "@/types";

export default function VerifyCreators() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listCreators()
      .then((all) =>
        setCreators(all.filter((c) => c.verificationStatus === "submitted")),
      )
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load creators."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verify Creators</h1>
        <p className="text-sm text-gray-500">
          Review submitted applications and assign affiliate codes.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !creators.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-emerald-50 p-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-lg font-semibold">All caught up</p>
            <p className="max-w-sm text-sm text-gray-500">
              There are no pending verification applications right now.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/creators")}
              className="mt-2"
            >
              Browse all creators
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {creators.map((c) => (
            <Card key={c.uid} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-3 bg-blue-50/50 pb-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">
                    {c.fullName}
                  </CardTitle>
                  <p className="truncate text-sm text-gray-500">{c.email}</p>
                </div>
                <Badge className="flex-shrink-0 bg-blue-100 text-blue-800 hover:bg-blue-100">
                  Awaiting Review
                </Badge>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Platform" value={c.platform || "—"} />
                  <Field
                    label="Followers"
                    value={c.followerCount || "—"}
                  />
                  <Field label="Niche" value={c.contentNiche || "—"} />
                  <Field
                    label="Submitted"
                    value={
                      c.verificationSubmittedAt
                        ? formatDate(c.verificationSubmittedAt)
                        : "—"
                    }
                  />
                  <Field
                    label="ID Type"
                    value={c.idProofType || "—"}
                  />
                  <Field
                    label="ID Number"
                    value={c.idProofNumber || "—"}
                    mono
                  />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Profile Link
                    </p>
                    {c.profileLink ? (
                      <a
                        href={c.profileLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="mt-0.5 font-medium">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      ID Document
                    </p>
                    {c.idProofFileUrl ? (
                      <a
                        href={c.idProofFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> View
                      </a>
                    ) : (
                      <p className="mt-0.5 font-medium text-amber-600">
                        Not uploaded
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Button onClick={() => navigate(`/admin/creator/${c.uid}`)}>
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Review & Decide
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className={`mt-0.5 truncate font-medium ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
