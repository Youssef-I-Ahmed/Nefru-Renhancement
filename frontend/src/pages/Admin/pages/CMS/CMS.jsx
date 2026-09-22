import { AlertTriangle, BadgeCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, EyeOff, Image as ImageIcon, MapPin, RefreshCw, Search, Undo2, ShieldCheck, Star, UsersRound, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveMediaUrl } from "../../../../services/api";
import {
  getTourModerationDetail,
  getTourModerationList,
  moderateTour,
} from "../../api";
import styles from "./CMS.module.css";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Awaiting review", value: "reviewing" },
  { label: "Live", value: "active" },
  { label: "Drafts", value: "draft" },
  { label: "Rejected", value: "rejected" },
];

const STATUS_LABELS = {
  reviewing: "Awaiting review",
  pending: "Awaiting review",
  active: "Live",
  draft: "Draft",
  rejected: "Rejected",
};

const ACTION_COPY = {
  return_changes: {
    title: "Request changes",
    description: "Send this experience back to the guide with a clear reason.",
    confirm: "Send feedback",
    placeholder: "Explain exactly what needs to be updated before resubmission…",
  },
  reject: {
    title: "Reject experience",
    description: "Reject this submission and tell the guide why.",
    confirm: "Reject experience",
    placeholder: "Explain why this experience cannot be approved…",
  },
  hide: {
    title: "Hide live experience",
    description: "Remove this experience from public discovery and tell the guide why.",
    confirm: "Hide experience",
    placeholder: "Explain why this live experience is being hidden…",
  },
};

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function money(value, currency = "EGP") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function initials(value = "Guide") {
  return String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TourStatus({ status }) {
  return (
    <span className={styles.status} data-status={status || "draft"}>
      {STATUS_LABELS[status] || status || "Draft"}
    </span>
  );
}

function Metric({ icon: Icon, label, value, helper }) {
  return (
    <article className={styles.metric}>
      <span><Icon size={18} /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{helper}</em></div>
    </article>
  );
}

export default function CMS() {
  const [activeFilter, setActiveFilter] = useState("reviewing");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState([]);
  const [meta, setMeta] = useState({ counts: {}, page: 1, totalPages: 1, pagingView: [1] });
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError("");
    const result = await getTourModerationList({ page, status: activeFilter, query: debouncedQuery });
    if (result.error) {
      setError(result.error);
      setList([]);
    } else {
      const tours = result.data?.tours || [];
      setList(tours);
      setMeta(result.meta || { counts: {}, page: 1, totalPages: 1, pagingView: [1] });
      if (selectedId && !tours.some((tour) => tour.id === selectedId)) {
        setSelectedId("");
        setDetail(null);
      }
    }
    setLoadingList(false);
  }, [activeFilter, debouncedQuery, page, selectedId]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    setError("");
    const result = await getTourModerationDetail(id);
    if (result.error) {
      setError(result.error);
      setDetail(null);
    } else {
      setDetail(result.data?.tour || null);
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => { const timer=setTimeout(loadList,0); return ()=>clearTimeout(timer); }, [loadList]);
  useEffect(() => { const timer=setTimeout(()=>{if(selectedId)loadDetail(selectedId);},0); return ()=>clearTimeout(timer); }, [loadDetail, selectedId]);

  const counts = meta.counts || {};
  const schedule = detail?.schedule?.slots || [];
  const visibleHistory = useMemo(
    () => [...(detail?.moderation?.history || [])].reverse(),
    [detail],
  );

  const selectTour = (tour) => {
    setSelectedId(tour.id);
    setDetail(null);
  };

  const changeFilter = (value) => {
    setActiveFilter(value);
    setPage(1);
    setSelectedId("");
    setDetail(null);
  };

  const refreshAll = async () => {
    await loadList();
    if (selectedId) await loadDetail(selectedId);
  };

  const publish = async () => {
    if (!detail || working) return;
    setWorking(true);
    setError("");
    const result = await moderateTour(detail.id, "publish");
    if (result.error) setError(result.error);
    else await refreshAll();
    setWorking(false);
  };

  const openReasonModal = (action) => {
    setReason("");
    setActionModal(action);
  };

  const submitReasonAction = async () => {
    if (!detail || !actionModal || !reason.trim() || working) return;
    setWorking(true);
    setError("");
    const result = await moderateTour(detail.id, actionModal, reason.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setActionModal(null);
      setReason("");
      await refreshAll();
    }
    setWorking(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Marketplace quality control</span>
          <h1>Tour moderation</h1>
          <p>Review submitted experiences, verify readiness, and control what is visible to travelers.</p>
        </div>
        <button type="button" onClick={refreshAll} disabled={loadingList || loadingDetail}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <section className={styles.metrics}>
        <Metric icon={ImageIcon} label="All experiences" value={counts.all ?? "—"} helper="Across every status" />
        <Metric icon={Clock3} label="Awaiting review" value={counts.reviewing ?? "—"} helper="Needs an admin decision" />
        <Metric icon={BadgeCheck} label="Live" value={counts.active ?? "—"} helper="Visible to travelers" />
        <Metric icon={AlertTriangle} label="Rejected" value={counts.rejected ?? "—"} helper="Requires a new submission" />
      </section>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.workspace}>
        <div className={styles.listPanel}>
          <div className={styles.filters}>
            <div className={styles.tabs}>
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  data-active={activeFilter === filter.value || undefined}
                  onClick={() => changeFilter(filter.value)}
                >
                  {filter.label}
                  <span>{counts[filter.value] ?? (filter.value === "all" ? counts.all : "")}</span>
                </button>
              ))}
            </div>
            <label className={styles.searchBox}>
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search title, city or category"
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
            </label>
          </div>

          <div className={styles.tourList}>
            {loadingList ? (
              <div className={styles.empty}>Loading experiences…</div>
            ) : list.length === 0 ? (
              <div className={styles.empty}><ImageIcon size={24} /><strong>No experiences in this view</strong><span>Try another status or search term.</span></div>
            ) : (
              list.map((tour) => (
                <button
                  key={tour.id}
                  type="button"
                  className={styles.tourRow}
                  data-selected={selectedId === tour.id || undefined}
                  onClick={() => selectTour(tour)}
                >
                  <span className={styles.rowImage}>
                    {tour.image ? <img src={resolveMediaUrl(tour.image)} alt="" /> : <ImageIcon size={20} />}
                  </span>
                  <span className={styles.rowMain}>
                    <strong>{tour.title}</strong>
                    <small><MapPin size={12} /> {tour.location} · {tour.category}</small>
                    <em>{tour.guide?.fullName || tour.guide?.email || "Guide"}</em>
                  </span>
                  <span className={styles.rowMeta}>
                    <TourStatus status={tour.status} />
                    <small>{formatDate(tour.updatedAt)}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))
            )}
          </div>

          {meta.totalPages > 1 && (
            <div className={styles.pagination}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
              {(meta.pagingView || []).map((value) => (
                <button key={value} type="button" data-active={page === value || undefined} onClick={() => setPage(value)}>{value}</button>
              ))}
              <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>

        <aside className={styles.detailPanel}>
          {!selectedId ? (
            <div className={styles.detailEmpty}><ShieldCheck size={28} /><h2>Select an experience</h2><p>Its guide, media, schedule, readiness and moderation history will appear here.</p></div>
          ) : loadingDetail ? (
            <div className={styles.detailEmpty}>Loading review details…</div>
          ) : detail ? (
            <>
              <div className={styles.detailHero}>
                {detail.image ? <img src={resolveMediaUrl(detail.image)} alt={detail.title} /> : <div className={styles.coverFallback}><ImageIcon size={30} /></div>}
                <div className={styles.heroOverlay}>
                  <TourStatus status={detail.status} />
                  <span>{detail.category}</span>
                </div>
              </div>

              <div className={styles.detailBody}>
                <div className={styles.titleBlock}>
                  <div><span>Experience review</span><h2>{detail.title}</h2><p><MapPin size={14} /> {detail.location}</p></div>
                  <div className={styles.rating}><Star size={15} fill="currentColor" /> {Number(detail.rating || 0).toFixed(1)} <small>({detail.reviewsCount || 0})</small></div>
                </div>

                <section className={styles.readiness} data-ready={detail.readiness?.ready || undefined}>
                  <span>{detail.readiness?.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
                  <div>
                    <strong>{detail.readiness?.ready ? "Ready to publish" : "Publish requirements incomplete"}</strong>
                    <p>{detail.readiness?.ready ? "Guide verification, media and future availability are in place." : `Missing: ${(detail.readiness?.missing || []).join(", ") || "Review required"}`}</p>
                  </div>
                </section>

                <div className={styles.summaryGrid}>
                  <div><Clock3 size={15} /><span><small>Duration</small><strong>{detail.duration}</strong></span></div>
                  <div><CircleDollarSign size={15} /><span><small>Price</small><strong>{money(detail.price, detail.currency)}</strong></span></div>
                  <div><UsersRound size={15} /><span><small>Group capacity</small><strong>{detail.groupSize || 1}</strong></span></div>
                  <div><CalendarDays size={15} /><span><small>Future slots</small><strong>{detail.readiness?.futureSlots || 0}</strong></span></div>
                </div>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><span>Experience content</span><strong>About & highlights</strong></div>
                  <p className={styles.description}>{detail.longDescription || detail.description}</p>
                  {(detail.highlights || []).length > 0 && <div className={styles.highlights}>{detail.highlights.map((item, index) => <span key={`${item.title}-${index}`}><CheckCircle2 size={13} /> {item.title}{item.text ? ` — ${item.text}` : ""}</span>)}</div>}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><span>Media review</span><strong>{1 + (detail.gallery?.length || 0)} asset(s)</strong></div>
                  <div className={styles.gallery}>
                    {detail.image && <img src={resolveMediaUrl(detail.image)} alt="Cover" />}
                    {(detail.gallery || []).map((image, index) => <img key={`${image}-${index}`} src={resolveMediaUrl(image)} alt={`Gallery ${index + 1}`} />)}
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><span>Guide</span><strong>{detail.guide?.verificationStatus === "approved" ? "Verified guide" : "Verification required"}</strong></div>
                  <div className={styles.guideCard}>
                    {detail.guide?.avatar ? <img src={resolveMediaUrl(detail.guide.avatar)} alt="" /> : <span>{initials(detail.guide?.fullName || detail.guide?.email)}</span>}
                    <div><strong>{detail.guide?.fullName || detail.guide?.email || "Guide"}</strong><small>{detail.guide?.headline || detail.guide?.email}</small><em>{detail.guide?.yearsExperience || 0} years experience · {(detail.guide?.languages || []).join(", ") || "Languages not added"}</em></div>
                    <span className={styles.guideStatus} data-approved={detail.guide?.verificationStatus === "approved" || undefined}>{detail.guide?.verificationStatus || "draft"}</span>
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><span>Availability</span><strong>{schedule.length} time slot(s)</strong></div>
                  {schedule.length === 0 ? <p className={styles.muted}>No schedule submitted.</p> : <div className={styles.scheduleList}>{schedule.slice(0, 12).map((slot) => <div key={slot.occurrenceKey || `${slot.date}-${slot.startTime}`}><CalendarDays size={13} /><span><strong>{slot.date}</strong><small>{slot.startTime} – {slot.endTime}</small></span><b>{slot.capacity} places</b></div>)}</div>}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><span>Marketplace activity</span><strong>Booking context</strong></div>
                  <div className={styles.bookingStats}>
                    <div><small>Total bookings</small><strong>{detail.bookingStats?.total || 0}</strong></div>
                    <div><small>Paid bookings</small><strong>{detail.bookingStats?.paid || 0}</strong></div>
                    <div><small>Paid revenue</small><strong>{money(detail.bookingStats?.paidRevenue, detail.currency)}</strong></div>
                  </div>
                </section>

                {(detail.moderation?.reason || visibleHistory.length > 0) && (
                  <section className={styles.section}>
                    <div className={styles.sectionTitle}><span>Moderation history</span><strong>{visibleHistory.length} action(s)</strong></div>
                    {detail.moderation?.reason && <div className={styles.currentFeedback}><AlertTriangle size={15} /><span><strong>Latest feedback</strong><p>{detail.moderation.reason}</p></span></div>}
                    <div className={styles.history}>{visibleHistory.slice(0, 6).map((item, index) => <div key={item._id || `${item.action}-${index}`}><span /><div><strong>{String(item.action || "reviewed").replaceAll("_", " ")}</strong><p>{item.reason || "No note added."}</p></div><time>{formatDate(item.reviewedAt, true)}</time></div>)}</div>
                  </section>
                )}
              </div>

              <footer className={styles.actionBar}>
                {["reviewing", "pending"].includes(detail.status) && (
                  <>
                    <button type="button" className={styles.secondaryAction} onClick={() => openReasonModal("return_changes")} disabled={working}><Undo2 size={16} /> Request changes</button>
                    <button type="button" className={styles.dangerAction} onClick={() => openReasonModal("reject")} disabled={working}><XCircle size={16} /> Reject</button>
                    <button type="button" className={styles.primaryAction} onClick={publish} disabled={working || !detail.readiness?.ready}><BadgeCheck size={16} /> {working ? "Working…" : "Publish"}</button>
                  </>
                )}
                {detail.status === "active" && <button type="button" className={styles.dangerAction} onClick={() => openReasonModal("hide")} disabled={working}><EyeOff size={16} /> Hide experience</button>}
                {["draft", "rejected"].includes(detail.status) && <p className={styles.waitingNote}>Waiting for the guide to update and resubmit this experience.</p>}
              </footer>
            </>
          ) : (
            <div className={styles.detailEmpty}>Unable to load this experience.</div>
          )}
        </aside>
      </section>

      {actionModal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !working && setActionModal(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="moderation-action-title">
            <button type="button" className={styles.modalClose} onClick={() => setActionModal(null)} disabled={working}><X size={18} /></button>
            <span className={styles.modalIcon}>{actionModal === "return_changes" ? <Undo2 size={21} /> : actionModal === "hide" ? <EyeOff size={21} /> : <XCircle size={21} />}</span>
            <h2 id="moderation-action-title">{ACTION_COPY[actionModal].title}</h2>
            <p>{ACTION_COPY[actionModal].description}</p>
            <label><span>Reason sent to the guide</span><textarea autoFocus rows="5" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={ACTION_COPY[actionModal].placeholder} maxLength={1000} /><small>{reason.length} / 1000</small></label>
            <div className={styles.modalActions}><button type="button" onClick={() => setActionModal(null)} disabled={working}>Cancel</button><button type="button" data-danger={actionModal !== "return_changes" || undefined} onClick={submitReasonAction} disabled={working || !reason.trim()}>{working ? "Saving…" : ACTION_COPY[actionModal].confirm}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
