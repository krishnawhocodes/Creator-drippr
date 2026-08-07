import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  listSupportTickets,
  replyToTicket,
  closeTicket,
} from "@/lib/adminDb";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LifeBuoy, Send, Archive, AlertCircle, MessageSquare } from "lucide-react";
import type { SupportTicket } from "@/types";

type Tab = "open" | "resolved" | "closed";

export default function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("open");
  const [busy, setBusy] = useState<string | null>(null);

  const [replyTarget, setReplyTarget] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState("");

  async function load() {
    setLoading(true);
    try {
      setTickets(await listSupportTickets());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReply() {
    if (!replyTarget || !replyText.trim()) return;
    setBusy(replyTarget.id);
    try {
      await replyToTicket(
        replyTarget.id,
        replyText.trim(),
        user?.email || "admin",
      );
      setReplyTarget(null);
      setReplyText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setBusy(null);
    }
  }

  async function handleClose(id: string) {
    setBusy(id);
    try {
      await closeTicket(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close ticket.");
    } finally {
      setBusy(null);
    }
  }

  const filtered = tickets.filter((t) => t.status === tab);
  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <p className="text-sm text-gray-500">
          Creator support tickets and enquiries.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({counts.resolved})
          </TabsTrigger>
          <TabsTrigger value="closed">Closed ({counts.closed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-gray-100 p-4">
              <LifeBuoy className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-lg font-semibold">No {tab} tickets</p>
            <p className="max-w-sm text-sm text-gray-500">
              {tab === "open"
                ? "When creators raise a support request from their panel, it will appear here."
                : `There are no ${tab} tickets.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {t.subject}
                  </CardTitle>
                  <p className="truncate text-sm text-gray-500">
                    {t.creatorName} · {t.creatorEmail} ·{" "}
                    {formatDate(t.createdAt)}
                  </p>
                </div>
                <Badge
                  className={
                    t.status === "open"
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      : t.status === "resolved"
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                  }
                >
                  {t.status}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-3.5">
                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {t.message}
                  </p>
                </div>

                {t.adminReply && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700">
                      <MessageSquare className="h-3 w-3" /> Your reply
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-emerald-900">
                      {t.adminReply}
                    </p>
                    {t.respondedAt && (
                      <p className="mt-2 text-xs text-emerald-700/70">
                        Sent {formatDate(t.respondedAt)}
                        {t.respondedBy ? ` by ${t.respondedBy}` : ""}
                      </p>
                    )}
                  </div>
                )}

                {t.status !== "closed" && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClose(t.id)}
                      disabled={busy === t.id}
                    >
                      <Archive className="mr-1.5 h-4 w-4" /> Close
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setReplyTarget(t);
                        setReplyText(t.adminReply || "");
                      }}
                      disabled={busy === t.id}
                    >
                      <Send className="mr-1.5 h-4 w-4" />
                      {t.adminReply ? "Edit Reply" : "Reply"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!replyTarget}
        onOpenChange={(o) => !o && setReplyTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to {replyTarget?.creatorName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Your reply</Label>
            <Textarea
              rows={5}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleReply} disabled={!replyText.trim() || !!busy}>
              {busy ? "Sending…" : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
