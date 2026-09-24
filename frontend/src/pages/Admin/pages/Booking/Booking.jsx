import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCopy,
  Clock3,
  CreditCard,
  RefreshCw,
  RotateCcw,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getBookingOperation,
  getBookingOperations,
  refundBookingOperation,
} from "../../api";
import { resolveMediaUrl } from "../../../../services/api";
import styles from "./Booking.module.css";

const BOOKING_FILTERS = [
  ["all", "All bookings"],
  ["pending_payment", "Payment holds"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["expired", "Expired"],
  ["refunded", "Refunded"],
];

const PAYMENT_FILTERS = [
  ["all", "All payments"],
  ["paid", "Paid"],
  ["unpaid", "Unpaid"],
  ["failed", "Failed"],
  ["refunded", "Refunded"],
  ["partially_refunded", "Partially refunded"],
];

function money(value, currency = "EGP") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTime(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(value = "") {
  const text = String(value || "");
  return text.length > 14 ? `${text.slice(0, 7)}…${text.slice(-5)}` : text || "—";
}

function label(value = "") {
  return String(value || "—").replaceAll("_", " ");
}

function statusTone(value) {
  if (["paid", "confirmed", "completed"].includes(value)) return "success";
  if (["pending_payment", "unpaid"].includes(value)) return "warning";
  if (["cancelled", "expired", "failed", "refunded"].includes(value)) return "danger";
  if (["partially_refunded", "processing"].includes(value)) return "warning";
  return "neutral";
}

function Stat({ icon: Icon, label: text, value, helper }) {
  return (
    <article className={styles.statCard}>
      <span className={styles.statIcon}><Icon size={19} /></span>
      <div><small>{text}</small><strong>{value}</strong>{helper && <em>{helper}</em>}</div>
    </article>
  );
}

function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className={styles.muted}>Not recorded</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className={styles.referenceValue} title={String(value)}>
      <code>{shortId(value)}</code>
      <button type="button" onClick={copy} aria-label="Copy reference"><ClipboardCopy size={14} /></button>
      {copied && <small>Copied</small>}
    </span>
  );
}

export default function Booking() {
  const [filters, setFilters] = useState({ page: 1, query: "", bookingStatus: "all", paymentStatus: "all", provider: "all" });
  const [draftQuery, setDraftQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await getBookingOperations(filters);
    if (response.error) setError(response.error);
    else setResult(response);
    setLoading(false);
  }, [filters]);

  useEffect(() => { const timer=setTimeout(load,0); return ()=>clearTimeout(timer); }, [load]);

  useEffect(() => {
    let active = true;
    const timer=setTimeout(()=>{
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    getBookingOperation(selectedId).then((response) => {
      if (!active) return;
      if (response.error) setDetailError(response.error);
      else setDetail(response.data);
      setDetailLoading(false);
    });
    },0);
    return () => { active = false; clearTimeout(timer); };
  }, [selectedId]);

  const stats = result?.meta?.stats || {};
  const rows = useMemo(() => result?.data || [], [result?.data]);
  const pages = result?.meta?.pagingView || [];
  const totalPages = result?.meta?.totalPages || 1;

  const activeHolds = useMemo(
    () => rows.filter((item) => item.status === "pending_payment" && item.holdExpiresAt && new Date(item.holdExpiresAt) > new Date()).length,
    [rows],
  );

  const applySearch = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, page: 1, query: draftQuery.trim() }));
  };

  const submitRefund = async () => {
    if (!detail || refundReason.trim().length < 3) return;

    setRefunding(true);
    setDetailError("");
    const response = await refundBookingOperation(
      detail.id,
      refundReason.trim(),
    );

    if (response.error) {
      setDetailError(response.error);
      setRefunding(false);
      return;
    }

    const refreshed = await getBookingOperation(detail.id);
    if (refreshed.error) setDetailError(refreshed.error);
    else setDetail(refreshed.data);

    setRefundOpen(false);
    setRefundReason("");
    setRefunding(false);
    await load();
  };

  const canRefund =
    detail &&
    detail.paymentProvider === "paymob" &&
    ["paid", "partially_refunded"].includes(detail.paymentStatus) &&
    detail.refundStatus !== "processing" &&
    detail.settlementStatus !== "settled";

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Booking operations</span><h1>Bookings & Paymob</h1><p>Inspect reservation state, payment references, holds, traveler details, and revenue records.</p></div>
        <button type="button" className={styles.refreshButton} onClick={load} disabled={loading}><RefreshCw size={17} /> Refresh</button>
      </header>

      <section className={styles.statsGrid}>
        <Stat icon={CalendarDays} label="All bookings" value={stats.total ?? "—"} helper={`${stats.completed ?? 0} completed`} />
        <Stat icon={CreditCard} label="Paid bookings" value={stats.paid ?? "—"} helper={`${stats.failed ?? 0} failed payments`} />
        <Stat icon={Clock3} label="Active payment holds" value={stats.pendingPayment ?? activeHolds} helper="15-minute checkout holds" />
        <Stat icon={CircleDollarSign} label="Gross paid revenue" value={stats.grossPaid == null ? "—" : money(stats.grossPaid)} helper={`${money(stats.platformFees || 0)} platform fees`} />
      </section>

      <section className={styles.controlCard}>
        <form className={styles.searchBox} onSubmit={applySearch}>
          <Search size={17} />
          <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Booking ID, Paymob reference, email, trip…" />
          <button type="submit">Search</button>
        </form>
        <div className={styles.filters}>
          <select value={filters.bookingStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, bookingStatus: event.target.value }))}>
            {BOOKING_FILTERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, page: 1, paymentStatus: event.target.value }))}>
            {PAYMENT_FILTERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <select value={filters.provider} onChange={(event) => setFilters((current) => ({ ...current, page: 1, provider: event.target.value }))}>
            <option value="all">All providers</option><option value="paymob">Paymob</option><option value="none">No provider</option>
          </select>
        </div>
      </section>

      {error && <div className={styles.error}><AlertTriangle size={18} /> {error}</div>}

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div><strong>Operational ledger</strong><span>{result?.meta?.totalRecords ?? 0} matching records</span></div>
          <span>Secrets are never exposed here.</span>
        </div>
        {loading ? (
          <div className={styles.state}>Loading booking operations…</div>
        ) : rows.length === 0 ? (
          <div className={styles.state}>No bookings match these filters.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Experience</th><th>Traveler</th><th>Date</th><th>Booking</th><th>Payment</th><th>Amount</th><th>Paymob</th></tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedId(item.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedId(item.id)}>
                    <td><span className={styles.tripCell}>{item.trip.image ? <img src={resolveMediaUrl(item.trip.image)} alt="" /> : <span className={styles.imageFallback} />}<span><strong>{item.trip.title}</strong><small>{item.trip.location || shortId(item.id)}</small></span></span></td>
                    <td><strong>{item.tourist.name}</strong><small>{item.tourist.email}</small></td>
                    <td><strong>{item.slotDate}</strong><small>{item.timeSlot}</small></td>
                    <td><span className={styles.pill} data-tone={statusTone(item.status)}>{label(item.status)}</span></td>
                    <td><span className={styles.pill} data-tone={statusTone(item.paymentStatus)}>{label(item.paymentStatus)}</span></td>
                    <td><strong>{money(item.totalPrice, item.currency)}</strong><small>{item.paymentMethod !== "none" ? label(item.paymentMethod) : "—"}</small></td>
                    <td><strong>{item.paymentProvider === "paymob" ? "Paymob" : "—"}</strong><small>{shortId(item.paymobTransactionId || item.paymobIntentionId)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.pagination}>
          <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
          <span className={styles.pageNumbers}>{pages.map((page) => <button key={page} type="button" data-active={page === filters.page || undefined} onClick={() => setFilters((current) => ({ ...current, page }))}>{page}</button>)}</span>
          <button type="button" disabled={filters.page >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
        </div>
      </section>

      {selectedId && (
        <div className={styles.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setSelectedId("")}>
          <aside className={styles.drawer} aria-label="Booking details">
            <header><div><span>Booking record</span><h2>{shortId(selectedId)}</h2></div><button type="button" onClick={() => setSelectedId("")} aria-label="Close"><X size={20} /></button></header>
            {detailLoading ? <div className={styles.state}>Loading booking details…</div> : detailError ? <div className={styles.error}>{detailError}</div> : detail && (
              <div className={styles.drawerBody}>
                <section className={styles.heroRecord}>
                  <div><strong>{detail.trip.title}</strong><span>{detail.trip.location}</span></div>
                  <div className={styles.heroPills}><span className={styles.pill} data-tone={statusTone(detail.status)}>{label(detail.status)}</span><span className={styles.pill} data-tone={statusTone(detail.paymentStatus)}>{label(detail.paymentStatus)}</span></div>
                </section>

                <section className={styles.detailCard}><h3>Reservation</h3><div className={styles.detailGrid}>
                  <div><span>Date</span><strong>{detail.slotDate}</strong></div><div><span>Time</span><strong>{detail.timeSlot}</strong></div>
                  <div><span>Account seats</span><strong>{detail.numberOfGuests}</strong></div><div><span>Seat allocation</span><strong>{detail.seat?.seatNumber ? `#${detail.seat.seatNumber}` : "Released / not allocated"}</strong></div>
                  <div><span>Created</span><strong>{dateTime(detail.createdAt)}</strong></div><div><span>Hold expires</span><strong>{dateTime(detail.holdExpiresAt)}</strong></div>
                </div></section>

                <section className={styles.peopleGrid}>
                  <article className={styles.detailCard}><h3><UsersRound size={17} /> Traveler</h3><strong>{detail.tourist.name}</strong><span>{detail.tourist.email}</span><span>{detail.tourist.phoneNumber || "No phone recorded"}</span></article>
                  <article className={styles.detailCard}><h3><UsersRound size={17} /> Guide</h3><strong>{detail.guide.name}</strong><span>{detail.guide.email}</span><span>{detail.guide.verificationStatus ? `${label(detail.guide.verificationStatus)} guide` : "Guide"}</span></article>
                </section>

                <section className={styles.detailCard}><h3><CreditCard size={17} /> Paymob & payment references</h3><div className={styles.references}>
                  <div><span>Provider</span><strong>{detail.paymentProvider === "paymob" ? "Paymob" : label(detail.paymentProvider)}</strong></div>
                  <div><span>Method</span><strong>{label(detail.paymentMethod)}</strong></div>
                  <div><span>Payment reference</span><CopyValue value={detail.paymentReference} /></div>
                  <div><span>Intention ID</span><CopyValue value={detail.paymobIntentionId} /></div>
                  <div><span>Order ID</span><CopyValue value={detail.paymobOrderId} /></div>
                  <div><span>Transaction ID</span><CopyValue value={detail.paymobTransactionId} /></div>
                </div>{detail.legacyStripeReference && <div className={styles.legacyNote}><AlertTriangle size={15} /> Historical Stripe reference: <CopyValue value={detail.legacyStripeReference} /></div>}</section>

                <section className={styles.detailCard}><h3><CircleDollarSign size={17} /> Money</h3><div className={styles.moneyRows}>
                  <span><small>Traveler paid / payable</small><strong>{money(detail.totalPrice, detail.currency)}</strong></span>
                  <span><small>Platform fee</small><strong>{money(detail.platformFee, detail.currency)}</strong></span>
                  <span><small>Guide earnings</small><strong>{money(detail.guideEarnings, detail.currency)}</strong></span>
                  <span><small>Refunded</small><strong>{money(detail.refundedAmount || 0, detail.currency)}</strong></span>
                </div></section>

                {detail.paymentProvider === "paymob" && (
                  <section className={styles.detailCard}>
                    <h3><RotateCcw size={17} /> Refund lifecycle</h3>
                    <div className={styles.detailGrid}>
                      <div><span>Entitlement</span><strong>{label(detail.refundEntitlement)}</strong></div>
                      <div><span>Refund status</span><strong>{label(detail.refundStatus)}</strong></div>
                      <div><span>Requested</span><strong>{money(detail.refundRequestedAmount || 0, detail.currency)}</strong></div>
                      <div><span>Completed</span><strong>{money(detail.refundedAmount || 0, detail.currency)}</strong></div>
                      <div><span>Requested at</span><strong>{dateTime(detail.refundRequestedAt)}</strong></div>
                      <div><span>Completed at</span><strong>{dateTime(detail.refundCompletedAt)}</strong></div>
                    </div>

                    {detail.refundProviderReference && (
                      <div className={styles.refundReference}>
                        <span>Refund transaction</span>
                        <CopyValue value={detail.refundProviderReference} />
                      </div>
                    )}

                    {detail.refundFailureReason && (
                      <div className={styles.refundError}>
                        <AlertTriangle size={15} />
                        {detail.refundFailureReason}
                      </div>
                    )}

                    {detail.refundStatus === "processing" && (
                      <div className={styles.refundNotice}>
                        Refund submitted to Paymob. NEFRU will finalize it from the provider response/webhook.
                      </div>
                    )}

                    {detail.settlementStatus === "settled" &&
                      ["paid", "partially_refunded"].includes(detail.paymentStatus) && (
                        <div className={styles.refundError}>
                          <AlertTriangle size={15} />
                          Guide earnings are already settled. This requires a manual finance recovery workflow.
                        </div>
                      )}

                    {canRefund && !refundOpen && (
                      <button
                        type="button"
                        className={styles.refundButton}
                        onClick={() => {
                          setRefundOpen(true);
                          setRefundReason(detail.cancellationReason || "");
                        }}
                      >
                        <RotateCcw size={16} />
                        {detail.refundedAmount > 0 ? "Refund remaining balance" : "Issue full refund"}
                      </button>
                    )}

                    {refundOpen && (
                      <div className={styles.refundPanel}>
                        <label>
                          <span>Admin refund reason</span>
                          <textarea
                            value={refundReason}
                            onChange={(event) => setRefundReason(event.target.value)}
                            maxLength={1000}
                            placeholder="Document why this refund is being issued…"
                          />
                        </label>
                        <p>
                          This sends the remaining captured amount to Paymob. On confirmation,
                          the booking becomes refunded and unsettled guide earnings are reduced to zero.
                        </p>
                        <div className={styles.refundActions}>
                          <button
                            type="button"
                            onClick={() => {
                              setRefundOpen(false);
                              setRefundReason("");
                            }}
                            disabled={refunding}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={styles.confirmRefund}
                            onClick={submitRefund}
                            disabled={refunding || refundReason.trim().length < 3}
                          >
                            {refunding ? "Submitting…" : "Confirm Paymob refund"}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {(detail.specialRequests?.length > 0 || detail.cancellationReason) && <section className={styles.detailCard}><h3>Operational notes</h3>{detail.specialRequests?.map((request) => <p key={request}>{request}</p>)}{detail.cancellationReason && <p><strong>Cancellation:</strong> {detail.cancellationReason} {detail.cancelledBy ? `(${detail.cancelledBy})` : ""}</p>}</section>}

                <section className={styles.timelineCard}><h3>Record timeline</h3><div className={styles.timeline}>
                  <span><i><CheckCircle2 size={14} /></i><div><strong>Booking created</strong><small>{dateTime(detail.createdAt)}</small></div></span>
                  {detail.paymobIntentionId && <span><i><CreditCard size={14} /></i><div><strong>Paymob checkout created</strong><small>Intention {shortId(detail.paymobIntentionId)}</small></div></span>}
                  {detail.paymobTransactionId && <span><i><CreditCard size={14} /></i><div><strong>Paymob transaction recorded</strong><small>{shortId(detail.paymobTransactionId)}</small></div></span>}
                  {detail.completedAt && <span><i><CheckCircle2 size={14} /></i><div><strong>Experience completed</strong><small>{dateTime(detail.completedAt)}</small></div></span>}
                  {detail.cancelledAt && <span><i><AlertTriangle size={14} /></i><div><strong>Booking closed</strong><small>{dateTime(detail.cancelledAt)}</small></div></span>}
                  {detail.refundRequestedAt && <span><i><RotateCcw size={14} /></i><div><strong>Refund requested</strong><small>{dateTime(detail.refundRequestedAt)}</small></div></span>}
                  {detail.refundCompletedAt && <span><i><CheckCircle2 size={14} /></i><div><strong>Refund completed</strong><small>{dateTime(detail.refundCompletedAt)}</small></div></span>}
                </div></section>

                <button type="button" className={styles.refreshDetail} onClick={() => { const id = selectedId; setSelectedId(""); window.setTimeout(() => setSelectedId(id), 0); }}><RefreshCw size={16} /> Refresh current state</button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
