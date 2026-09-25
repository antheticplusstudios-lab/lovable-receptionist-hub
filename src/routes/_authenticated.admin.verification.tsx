import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CheckCircle2, Copy, ExternalLink, Globe, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminPage, DataTable, Loading, Panel, StatusPill, money, shortDate, timeAgo } from "@/components/admin-ui";
import { useAllPayments, useReviewPayment } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/admin/verification")({ component: VerificationPage });

type Payment = {
  id: string;
  amount: number;
  automation_slug: string;
  billing_plan: string;
  sender_name: string;
  payment_method: string;
  transaction_id: string;
  origin: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

type ApprovalResult = {
  crawled?: boolean;
  snippet?: string;
  automationId?: string | null;
  crawlUrl?: string;
  crawlChars?: number;
};

function ApprovalModal({ result, payment, onClose }: { result: ApprovalResult; payment: Payment; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Approved and live
          </DialogTitle>
          <DialogDescription>
            {payment.automation_slug} for {payment.sender_name} is active. Send them this script.
          </DialogDescription>
        </DialogHeader>
        <div
          className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
            result.crawled ? "bg-secondary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.crawled ? <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <div>
            <p className="font-bold">{result.crawled ? "Website crawled" : "Website couldn't be reached"}</p>
            <p className="text-xs opacity-80">
              {result.crawled
                ? `${(result.crawlChars ?? 0).toLocaleString()} characters saved from ${result.crawlUrl} to the knowledge base.`
                : `Add knowledge manually on the Knowledge Drafts page${result.crawlUrl ? ` (tried ${result.crawlUrl})` : ""}.`}
            </p>
          </div>
        </div>
        {result.snippet ? (
          <>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-muted p-4 text-xs">
              <code>{result.snippet}</code>
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(result.snippet ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy script"}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/automations">
                  <ExternalLink /> Open automations
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This payment isn't linked to an automation, so no script was created.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VerificationCard({ payment }: { payment: Payment }) {
  const review = useReviewPayment();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [decided, setDecided] = useState(false);
  const [result, setResult] = useState<ApprovalResult | null>(null);

  const approve = () => {
    review.mutate(
      { paymentId: payment.id, approve: true, reason: "" },
      {
        onSuccess: (r: unknown) => {
          setDecided(true);
          setResult((r ?? {}) as ApprovalResult);
        },
      },
    );
  };
  const reject = () => {
    review.mutate({ paymentId: payment.id, approve: false, reason }, { onSuccess: () => setDecided(true) });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      {result && <ApprovalModal result={result} payment={payment} onClose={() => setResult(null)} />}
      <div>
        <p className="text-2xl font-extrabold tabular-nums">{money(payment.amount)}</p>
        <p className="text-sm font-semibold">{payment.automation_slug}</p>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{payment.billing_plan}</p>
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>Client: <span className="font-semibold text-foreground">{payment.sender_name}</span></p>
        <p>Method: {payment.payment_method}</p>
        <p>Transaction: {payment.transaction_id}</p>
        <p className="capitalize">Origin: {payment.origin}</p>
        <p>Submitted {timeAgo(payment.submitted_at)}</p>
      </div>
      {decided ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Decision recorded. The owner and partner receive the audit record.
        </p>
      ) : rejecting ? (
        <div className="grid gap-2">
          <Textarea
            placeholder="Reason for rejection…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRejecting(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={reject}
              disabled={!reason.trim() || review.isPending}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm rejection
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={approve}
            disabled={review.isPending}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Approve payment
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejecting(true)}
            disabled={review.isPending}
            className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function VerificationPage() {
  const { data: payments, isLoading } = useAllPayments();

  const all = (payments ?? []) as Payment[];
  const pending = useMemo(() => all.filter((p) => p.status === "pending"), [all]);
  const decided = useMemo(() => {
    const cutoff = Date.now() - 14 * 86_400_000;
    return all.filter((p) => p.status !== "pending" && p.reviewed_at && new Date(p.reviewed_at).getTime() >= cutoff);
  }, [all]);

  if (isLoading) return <Loading />;

  return (
    <AdminPage
      title="Verification Queue"
      subtitle="The only screen a Payment Verifier can reach. Approve or reject manual payments; every decision is written to the immutable audit trail."
    >
      <Panel title={`Pending review (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing waiting for review.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <VerificationCard key={p.id} payment={p} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Decided in the last 14 days">
        <DataTable
          head={["Submitted", "Client", "Amount", "Status", "Reviewed at", "Rejection reason"]}
          empty="No decisions in this window."
          rows={decided.map((p) => [
            timeAgo(p.submitted_at),
            p.sender_name,
            <span className="tabular-nums" key="amount">{money(p.amount)}</span>,
            <StatusPill status={p.status} key="status" />,
            shortDate(p.reviewed_at),
            p.rejection_reason ?? "—",
          ])}
        />
      </Panel>
    </AdminPage>
  );
}
