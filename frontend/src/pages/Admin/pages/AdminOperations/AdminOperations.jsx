import {
  Activity, AlertTriangle, Archive, BadgeCheck, CalendarClock, CheckCircle2,
  ChevronRight, Eye, EyeOff, FileCheck2, Flag, ListChecks, MapPinned,
  RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Sparkles, Star, UserCheck,
  UsersRound, X, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest, resolveMediaUrl } from "../../../../services/api";
import styles from "./AdminOperations.module.css";

const REVIEW_POLICY_REASONS = [
  ["spam", "Spam"],
  ["fake_content", "Fake content"],
  ["abuse", "Abuse / harassment"],
  ["threats", "Threats"],
  ["personal_information", "Personal information"],
  ["irrelevant", "Irrelevant"],
  ["fraud", "Fraud"],
  ["prohibited_content", "Prohibited content"],
  ["policy_violation", "Other policy violation"],
];

const TABS = [
  ["reviews", "Reviews"],
  ["cases", "Cases"],
  ["verification", "Verification"],
  ["marketplace", "Marketplace"],
  ["live", "Live ops"],
];

const idOf = (value) => String(value?._id || value || "");
const humanize = (value = "") =>
  String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value, withTime = false) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
};

const tone = (value) => {
  if (["published", "approved", "completed", "checked_in", "live"].includes(value)) return "success";
  if (["pending_moderation", "pending", "renewal_in_review", "in_review", "upcoming", "check_in_open"].includes(value)) return "warning";
  if (["rejected", "hidden", "cancelled", "expired", "no_show"].includes(value)) return "danger";
  if (["in_progress", "paused_by_guide"].includes(value)) return "info";
  return "neutral";
};

function Status({ value }) {
  return <span className={styles.status} data-tone={tone(value)}>{humanize(value)}</span>;
}

function Stat({ icon: Icon, label, value, helper }) {
  return (
    <article className={styles.statCard}>
      <span className={styles.statIcon}><Icon size={19} /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{helper}</em></div>
    </article>
  );
}

function Empty({ icon: Icon = ListChecks, title, text, link, linkLabel }) {
  return (
    <div className={styles.empty}>
      <Icon size={26} />
      <h3>{title}</h3>
      <p>{text}</p>
      {link && <Link to={link}>{linkLabel || "Open"}</Link>}
    </div>
  );
}

function Initials({ name = "User" }) {
  const value = name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className={styles.avatarFallback}>{value || "U"}</span>;
}

export default function AdminOperations() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("reviews");
  const [reviewFilter, setReviewFilter] = useState("pending_moderation");
  const [busyKey, setBusyKey] = useState("");
  const [actionModal, setActionModal] = useState(null);
  const [reason, setReason] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailType, setDetailType] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await apiRequest("/marketplace/dashboard");
      setData(response.data || {});
    } catch (requestError) {
      setError(requestError.message || "Unable to load trust & safety operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const reviews = useMemo(() => Array.isArray(data.reviews) ? data.reviews : [], [data.reviews]);
  const cases = useMemo(() => Array.isArray(data.cases) ? data.cases : [], [data.cases]);
  const verifications = useMemo(() => Array.isArray(data.verifications) ? data.verifications : [], [data.verifications]);
  const trips = useMemo(() => Array.isArray(data.trips) ? data.trips : [], [data.trips]);
  const revisions = useMemo(() => Array.isArray(data.revisions) ? data.revisions : [], [data.revisions]);
  const occurrences = useMemo(() => Array.isArray(data.occurrences) ? data.occurrences : [], [data.occurrences]);

  const pendingReviews = reviews.filter((item) => item.moderationStatus === "pending_moderation").length;
  const publishedReviews = reviews.filter((item) => item.moderationStatus === "published").length;
  const marketplaceReviewCount =
    trips.filter((item) => item.reviewStatus === "in_review").length +
    revisions.filter((item) => item.reviewStatus === "in_review").length;

  const filteredReviews = reviews.filter((item) => {
    if (reviewFilter === "all") return true;
    if (reviewFilter === "closed") return ["hidden", "rejected"].includes(item.moderationStatus);
    return item.moderationStatus === reviewFilter;
  });

  const clearMessages = () => { setError(""); setNotice(""); };

  const runAction = async (key, path, payload = {}, successMessage = "Action completed.") => {
    setBusyKey(key);
    clearMessages();
    try {
      await apiRequest(`/marketplace/${path}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(successMessage);
      await load();
      return true;
    } catch (requestError) {
      setError(requestError.message || "Unable to complete that action.");
      return false;
    } finally {
      setBusyKey("");
    }
  };

  const openAction = (config) => {
    clearMessages();
    setReason("");
    setPolicyReason("");
    setExpiryDate("");
    setActionModal(config);
  };

  const closeAction = () => {
    if (busyKey) return;
    setActionModal(null);
    setReason("");
    setPolicyReason("");
    setExpiryDate("");
  };

  const submitAction = async () => {
    if (!actionModal) return;
    const { key, path, successMessage, reasonMode = "none", payload = {}, verificationKind } = actionModal;

    if (reasonMode === "text" && reason.trim().length < 3) {
      setError("Add a clear reason before confirming this action.");
      return;
    }
    if (reasonMode === "policy" && !policyReason) {
      setError("Select the policy reason that applies.");
      return;
    }
    if (verificationKind === "license" && actionModal.action === "approve" && !expiryDate) {
      setError("A valid future expiry date is required for a license approval.");
      return;
    }

    const finalPayload = {
      ...payload,
      ...(reasonMode === "text" ? { reason: reason.trim() } : {}),
      ...(reasonMode === "policy" ? { reason: policyReason } : {}),
      ...(verificationKind ? { kind: verificationKind } : {}),
      ...(verificationKind === "license" && actionModal.action === "approve" ? { expiryDate } : {}),
    };

    const ok = await runAction(key, path, finalPayload, successMessage);
    if (ok) closeAction();
  };

  const openDetail = async (type, id) => {
    setDetail(null);
    setDetailType(type);
    setDetailLoading(true);
    clearMessages();
    try {
      const response = await apiRequest(`/marketplace/${type}/${id}`);
      setDetail(response.data || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load confidential detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailType("");
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div className={styles.loading} role="status">
        <span className={styles.spinner} />
        <h1>Loading trust & safety…</h1>
        <p>Preparing moderation queues and operational cases.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ShieldAlert size={15} /> Trust, safety & marketplace operations</span>
          <h1>Operations center</h1>
          <p>Review public content, resolve traveler issues, verify guides, and supervise marketplace exceptions without mixing unrelated workflows.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={load} disabled={Boolean(busyKey)}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <section className={styles.statsGrid}>
        <Stat icon={Star} label="Reviews waiting" value={pendingReviews} helper={`${publishedReviews} currently published`} />
        <Stat icon={Flag} label="Open cases" value={cases.length} helper="Needs an operational decision" />
        <Stat icon={FileCheck2} label="Verification queue" value={verifications.length} helper="Identity or license review" />
        <Stat icon={MapPinned} label="Marketplace review" value={marketplaceReviewCount} helper="Trips and revisions in review" />
      </section>

      {error && <div className={styles.errorBanner} role="alert"><AlertTriangle size={18} /><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <div className={styles.successBanner} role="status"><CheckCircle2 size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}

      <section className={styles.workspace}>
        <nav className={styles.tabs} aria-label="Trust and safety work queues">
          {TABS.map(([value, label]) => {
            const count = {
              reviews: pendingReviews,
              cases: cases.length,
              verification: verifications.length,
              marketplace: marketplaceReviewCount,
              live: occurrences.filter((item) => ["upcoming", "check_in_open", "in_progress"].includes(item.status)).length,
            }[value];
            return (
              <button key={value} type="button" data-active={activeTab === value || undefined} onClick={() => setActiveTab(value)}>
                <span>{label}</span><b>{count}</b>
              </button>
            );
          })}
        </nav>

        {activeTab === "reviews" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.sectionKicker}>Public content</span>
                <h2>Review moderation</h2>
                <p>Negative ratings are valid feedback. Reject or hide only when a documented policy reason applies.</p>
              </div>
              <div className={styles.segmented}>
                {[["pending_moderation","Pending"],["published","Published"],["closed","Hidden / rejected"],["all","All"]].map(([value,label]) => (
                  <button key={value} type="button" data-active={reviewFilter === value || undefined} onClick={() => setReviewFilter(value)}>{label}</button>
                ))}
              </div>
            </div>

            {filteredReviews.length === 0 ? (
              <Empty icon={Star} title="No reviews in this queue" text="Reviews will appear here when they reach this moderation state." />
            ) : (
              <div className={styles.reviewList}>
                {filteredReviews.map((review) => {
                  const reviewId = idOf(review._id);
                  const travelerName = review.context?.tourist?.fullName || "Traveler";
                  const guideName = review.context?.guide?.fullName || "Guide";
                  const tripTitle = review.context?.trip?.title || "Experience";
                  const avatar = review.context?.tourist?.avatar ? resolveMediaUrl(review.context.tourist.avatar) : "";
                  return (
                    <article className={styles.reviewCard} key={reviewId}>
                      <div className={styles.reviewTop}>
                        <div className={styles.reviewer}>
                          {avatar ? <img src={avatar} alt="" aria-hidden="true" /> : <Initials name={travelerName} />}
                          <div><strong>{travelerName}</strong><small>{tripTitle} · Guide: {guideName}</small></div>
                        </div>
                        <Status value={review.moderationStatus} />
                      </div>

                      <div className={styles.ratingRow}>
                        <span className={styles.stars}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={15} fill={index < Number(review.rating || 0) ? "currentColor" : "none"} />)}</span>
                        <strong>{review.rating}/5</strong>
                        {review.isVerifiedBooking && <span className={styles.verified}><BadgeCheck size={13} /> Verified experience</span>}
                        <time>{formatDate(review.createdAt)}</time>
                      </div>

                      {review.title && <h3>{review.title}</h3>}
                      <p className={styles.reviewText}>{review.comment}</p>

                      <div className={styles.cardActions}>
                        <button type="button" className={styles.secondaryAction} onClick={() => openDetail("reviews", reviewId)}><Eye size={15} /> Booking & private survey</button>
                        {review.moderationStatus === "pending_moderation" && (
                          <>
                            <button type="button" className={styles.primaryAction} disabled={Boolean(busyKey)} onClick={() => runAction(`publish:${reviewId}`, `reviews/${reviewId}/actions/publish`, {}, "Review published and ratings recalculated.")}><CheckCircle2 size={15} /> Publish</button>
                            <button type="button" className={styles.dangerAction} disabled={Boolean(busyKey)} onClick={() => openAction({
                              key: `reject:${reviewId}`, path: `reviews/${reviewId}/actions/reject`, reasonMode: "policy",
                              title: "Reject this review?", description: "Choose the policy reason. The rating itself is not a valid rejection reason.",
                              confirmLabel: "Reject review", successMessage: "Review rejected under the selected policy reason.",
                            })}><XCircle size={15} /> Reject</button>
                          </>
                        )}
                        {review.moderationStatus === "published" && (
                          <button type="button" className={styles.dangerAction} disabled={Boolean(busyKey)} onClick={() => openAction({
                            key: `hide:${reviewId}`, path: `reviews/${reviewId}/actions/hide`, reasonMode: "policy",
                            title: "Hide published review?", description: "Hiding removes the review from public surfaces and recalculates ratings.",
                            confirmLabel: "Hide review", successMessage: "Review hidden and ratings recalculated.",
                          })}><EyeOff size={15} /> Hide</button>
                        )}
                        {review.moderationStatus === "hidden" && (
                          <button type="button" className={styles.primaryAction} disabled={Boolean(busyKey)} onClick={() => runAction(`republish:${reviewId}`, `reviews/${reviewId}/actions/publish`, {}, "Review republished and ratings recalculated.")}><RotateCcw size={15} /> Republish</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "cases" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.sectionKicker}>Operational exceptions</span><h2>Open cases</h2><p>Attendance disputes, safety signals, refund review, and guide no-show investigations.</p></div>
            </div>
            {cases.length === 0 ? <Empty icon={ShieldCheck} title="No open operational cases" text="New disputes and safety escalations will appear here automatically." /> : (
              <div className={styles.caseGrid}>
                {cases.map((item) => {
                  const caseId = idOf(item._id);
                  return (
                    <article className={styles.caseCard} key={caseId}>
                      <div className={styles.caseHeader}>
                        <span className={styles.caseIcon}><Flag size={18} /></span>
                        <div><strong>{humanize(item.type)}</strong><small>Opened {formatDate(item.createdAt, true)}</small></div>
                        <Status value={item.status} />
                      </div>
                      <p>{item.report}</p>
                      <div className={styles.referenceLine}><span>Booking</span><code>{idOf(item.booking).slice(-10) || "—"}</code></div>
                      <div className={styles.cardActions}>
                        <button type="button" className={styles.secondaryAction} onClick={() => openDetail("cases", caseId)}><Eye size={15} /> Inspect confidential evidence</button>
                        {item.type === "attendance_dispute" ? (
                          <>
                            <button type="button" className={styles.primaryAction} onClick={() => openAction({
                              key: `case-attended:${caseId}`, path: `cases/${caseId}/resolve`, reasonMode: "text", payload: { attendance: "checked_in" },
                              title: "Resolve as attended?", description: "Document why the evidence supports attendance before resolving.", confirmLabel: "Resolve: attended", successMessage: "Attendance dispute resolved as attended.",
                            })}><UserCheck size={15} /> Attended</button>
                            <button type="button" className={styles.dangerAction} onClick={() => openAction({
                              key: `case-noshow:${caseId}`, path: `cases/${caseId}/resolve`, reasonMode: "text", payload: { attendance: "no_show" },
                              title: "Resolve as no-show?", description: "Document why the evidence supports a no-show finding.", confirmLabel: "Resolve: no-show", successMessage: "Attendance dispute resolved as no-show.",
                            })}><XCircle size={15} /> No-show</button>
                          </>
                        ) : (
                          <button type="button" className={styles.primaryAction} onClick={() => openAction({
                            key: `case:${caseId}`, path: `cases/${caseId}/resolve`, reasonMode: "text",
                            title: `Resolve ${humanize(item.type)} case?`, description: "Add the investigation outcome. This note becomes part of the operational record.", confirmLabel: "Resolve case", successMessage: "Operational case resolved.",
                          })}><CheckCircle2 size={15} /> Resolve after investigation</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "verification" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.sectionKicker}>Guide trust</span><h2>Verification queue</h2><p>Review document evidence in Accounts first, then decide the submitted identity or activity license.</p></div>
              <Link className={styles.headerLink} to="/admin/accounts">Open Accounts <ChevronRight size={15} /></Link>
            </div>
            {verifications.length === 0 ? <Empty icon={FileCheck2} title="Verification queue is clear" text="New identity and license submissions will appear here." link="/admin/accounts" linkLabel="Review all guide accounts" /> : (
              <div className={styles.verificationList}>
                {verifications.map((guide) => {
                  const guideId = idOf(guide.user);
                  const identityStatus = guide.identityStatus || guide.verificationStatus;
                  const identityNeedsReview = ["pending", "renewal_in_review", "expired"].includes(identityStatus);
                  const licenseNeedsReview = ["pending", "renewal_in_review", "expired"].includes(guide.licenseStatus);
                  return (
                    <article className={styles.verificationCard} key={idOf(guide._id)}>
                      <div className={styles.verificationIdentity}><Initials name={guide.fullName} /><div><strong>{guide.fullName}</strong><small>Guide verification</small></div></div>
                      <div className={styles.verificationStates}>
                        <div><span>Identity</span><Status value={identityStatus} />{guide.identityExpiresAt && <small>Expires {formatDate(guide.identityExpiresAt)}</small>}</div>
                        <div><span>Activity license</span><Status value={guide.licenseStatus} />{guide.licenseExpiresAt && <small>Expires {formatDate(guide.licenseExpiresAt)}</small>}</div>
                      </div>
                      <div className={styles.cardActions}>
                        <Link className={styles.linkAction} to="/admin/accounts"><Eye size={15} /> Inspect documents</Link>
                        {identityNeedsReview && (
                          <>
                            <button type="button" className={styles.primaryAction} onClick={() => openAction({
                              key: `identity-approve:${guideId}`, path: `verification/${guideId}/actions/approve`, verificationKind: "identity", action: "approve",
                              title: "Approve identity document?", description: "Confirm the document is authentic and matches the guide account.", confirmLabel: "Approve identity", successMessage: "Guide identity approved.",
                            })}><BadgeCheck size={15} /> Approve identity</button>
                            <button type="button" className={styles.dangerAction} onClick={() => openAction({
                              key: `identity-reject:${guideId}`, path: `verification/${guideId}/actions/reject`, verificationKind: "identity", action: "reject", reasonMode: "text",
                              title: "Reject identity submission?", description: "Explain what is invalid or what must be replaced.", confirmLabel: "Reject identity", successMessage: "Identity submission rejected.",
                            })}><XCircle size={15} /> Reject</button>
                          </>
                        )}
                        {licenseNeedsReview && (
                          <>
                            <button type="button" className={styles.primaryAction} onClick={() => openAction({
                              key: `license-approve:${guideId}`, path: `verification/${guideId}/actions/approve`, verificationKind: "license", action: "approve",
                              title: "Approve activity license?", description: "A future expiry date is required before approval.", confirmLabel: "Approve license", successMessage: "Guide activity license approved.",
                            })}><FileCheck2 size={15} /> Approve license</button>
                            <button type="button" className={styles.dangerAction} onClick={() => openAction({
                              key: `license-reject:${guideId}`, path: `verification/${guideId}/actions/reject`, verificationKind: "license", action: "reject", reasonMode: "text",
                              title: "Reject activity license?", description: "Explain why the submitted license cannot be accepted.", confirmLabel: "Reject license", successMessage: "Activity license rejected.",
                            })}><XCircle size={15} /> Reject license</button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "marketplace" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.sectionKicker}>Marketplace control</span><h2>Listing lifecycle exceptions</h2><p>Full content review belongs in Tour moderation. This queue handles lifecycle and merchandising exceptions.</p></div>
              <Link className={styles.headerLink} to="/admin/cms">Open Tour moderation <ChevronRight size={15} /></Link>
            </div>
            <div className={styles.marketplaceGrid}>
              <section className={styles.subPanel}>
                <div className={styles.subPanelHeader}><strong>Trips</strong><span>{trips.length} records</span></div>
                <div className={styles.compactList}>
                  {trips.map((trip) => {
                    const tripId = idOf(trip._id);
                    return (
                      <div className={styles.compactRow} key={tripId}>
                        <div><strong>{trip.title}</strong><small>{humanize(trip.lifecycleStatus)} · {humanize(trip.reviewStatus)}</small></div>
                        <div className={styles.compactActions}>
                          {trip.reviewStatus === "rejected" && <button type="button" onClick={() => openAction({
                            key: `reopen:${tripId}`, path: `trips/${tripId}/actions/reopen`, reasonMode: "text",
                            title: "Reopen rejected experience?", description: "Explain why the submission is being reopened.", confirmLabel: "Reopen", successMessage: "Experience reopened.",
                          })}><RotateCcw size={14} /> Reopen</button>}
                          {trip.lifecycleStatus === "live" && <button type="button" onClick={() => openAction({
                            key: `hide-trip:${tripId}`, path: `trips/${tripId}/actions/hide`, reasonMode: "text",
                            title: "Hide live experience?", description: "This removes the experience from traveler discovery until restored.", confirmLabel: "Hide experience", successMessage: "Experience hidden.",
                          })}><EyeOff size={14} /> Hide</button>}
                          {trip.lifecycleStatus === "hidden_by_admin" && <button type="button" onClick={() => runAction(`restore:${tripId}`, `trips/${tripId}/actions/restore`, {}, "Experience restored to paused state.")}><RotateCcw size={14} /> Restore</button>}
                          <button type="button" onClick={() => runAction(`feature:${tripId}`, `merchandising/trips/${tripId}`, { featured: !trip.featured }, trip.featured ? "Feature removed." : "Experience featured.")}><Sparkles size={14} /> {trip.featured ? "Unfeature" : "Feature"}</button>
                          {trip.lifecycleStatus !== "archived" && <button type="button" onClick={() => openAction({
                            key: `archive:${tripId}`, path: `trips/${tripId}/actions/archive`, reasonMode: "text",
                            title: "Archive this experience?", description: "Archiving closes the listing lifecycle. Record the administrative reason.", confirmLabel: "Archive", successMessage: "Experience archived.",
                          })}><Archive size={14} /> Archive</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={styles.subPanel}>
                <div className={styles.subPanelHeader}><strong>Revisions awaiting review</strong><span>{revisions.length} records</span></div>
                {revisions.length === 0 ? <p className={styles.muted}>No revisions awaiting an admin decision.</p> : (
                  <div className={styles.compactList}>
                    {revisions.map((revision) => {
                      const revisionId = idOf(revision._id);
                      return (
                        <div className={styles.revisionRow} key={revisionId}>
                          <div><strong>{revision.content?.title || "Experience revision"}</strong><small>EGP {Number(revision.content?.price || 0).toLocaleString("en-US")} · {revision.content?.duration || "—"} · {revision.content?.location || "—"}</small></div>
                          <div className={styles.compactActions}>
                            <button type="button" className={styles.primaryMini} onClick={() => runAction(`revision-approve:${revisionId}`, `revisions/${revisionId}/actions/approve`, {}, "Revision approved.")}><CheckCircle2 size={14} /> Approve</button>
                            <button type="button" onClick={() => openAction({
                              key: `revision-changes:${revisionId}`, path: `revisions/${revisionId}/actions/request_changes`, reasonMode: "text",
                              title: "Request revision changes?", description: "Explain what the guide must update.", confirmLabel: "Request changes", successMessage: "Changes requested from guide.",
                            })}>Request changes</button>
                            <button type="button" onClick={() => openAction({
                              key: `revision-reject:${revisionId}`, path: `revisions/${revisionId}/actions/reject`, reasonMode: "text",
                              title: "Reject this revision?", description: "Explain why this revision cannot proceed.", confirmLabel: "Reject revision", successMessage: "Revision rejected.",
                            })}><XCircle size={14} /> Reject</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </section>
        )}

        {activeTab === "live" && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.sectionKicker}>Live supervision</span><h2>Scheduled experience oversight</h2><p>Guide-owned attendance stays with the guide. Admin actions here are for exceptional intervention.</p></div>
              <Link className={styles.headerLink} to="/admin/booking">Open Bookings <ChevronRight size={15} /></Link>
            </div>
            {occurrences.length === 0 ? <Empty icon={CalendarClock} title="No scheduled occurrences" text="Scheduled experience instances will appear here." /> : (
              <div className={styles.liveList}>
                {occurrences.map((occurrence) => {
                  const occurrenceId = idOf(occurrence._id);
                  const trip = trips.find((item) => idOf(item._id) === idOf(occurrence.trip));
                  return (
                    <article className={styles.liveRow} key={occurrenceId}>
                      <div className={styles.liveIdentity}><span className={styles.liveIcon}><Activity size={18} /></span><div><strong>{trip?.title || "Experience"}</strong><small>{formatDate(occurrence.startsAt, true)} – {formatDate(occurrence.endsAt, true)}</small></div></div>
                      <Status value={occurrence.status} />
                      <div className={styles.liveMeta}><span><UsersRound size={14} /> Capacity {occurrence.capacity || "—"}</span></div>
                      <div className={styles.compactActions}>
                        {["upcoming", "check_in_open"].includes(occurrence.status) && (
                          <>
                            <button type="button" onClick={() => runAction(`admin-start:${occurrenceId}`, `occurrences/${occurrenceId}/actions/start`, {}, "Experience started by admin intervention.")}>Start</button>
                            <button type="button" onClick={() => openAction({
                              key: `admin-cancel:${occurrenceId}`, path: `occurrences/${occurrenceId}/actions/cancel`, reasonMode: "text",
                              title: "Cancel scheduled experience?", description: "Confirmed travelers will be cancelled and notified. Add the reason.", confirmLabel: "Cancel occurrence", successMessage: "Occurrence cancelled.",
                            })}><XCircle size={14} /> Cancel</button>
                          </>
                        )}
                        {occurrence.status === "in_progress" && <button type="button" onClick={() => runAction(`admin-end:${occurrenceId}`, `occurrences/${occurrenceId}/actions/end`, {}, "Experience completed by admin intervention.")}>End</button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </section>

      {(detailLoading || detail) && (
        <div className={styles.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && closeDetail()}>
          <aside className={styles.drawer} aria-label="Confidential operational detail">
            <header className={styles.drawerHeader}>
              <div><span>Authorized admin only</span><h2>{detailType === "reviews" ? "Review evidence" : "Case evidence"}</h2></div>
              <button type="button" onClick={closeDetail} aria-label="Close detail"><X size={19} /></button>
            </header>
            {detailLoading ? <div className={styles.drawerState}>Loading confidential evidence…</div> : detailType === "reviews" && detail ? (
              <div className={styles.drawerBody}>
                <section className={styles.identityGrid}>
                  <article><span>Traveler</span><strong>{detail.context?.tourist?.fullName || "Traveler"}</strong><small>{detail.context?.tourist?.email || "Email unavailable"}</small></article>
                  <article><span>Guide</span><strong>{detail.context?.guide?.fullName || "Guide"}</strong><small>{detail.context?.guide?.email || "Email unavailable"}</small></article>
                </section>
                <section className={styles.detailCard}>
                  <span className={styles.detailLabel}>Experience & booking</span><h3>{detail.context?.trip?.title || "Experience"}</h3>
                  <div className={styles.detailFacts}>
                    <span>Payment <strong>{humanize(detail.booking?.paymentStatus)}</strong></span>
                    <span>Booking <strong>{humanize(detail.booking?.status)}</strong></span>
                    <span>Attendance <strong>{humanize(detail.booking?.attendance?.status || "booked")}</strong></span>
                    <span>Verified <strong>{detail.review?.isVerifiedBooking ? "Yes" : "No"}</strong></span>
                  </div>
                </section>
                <section className={styles.detailCard}>
                  <span className={styles.detailLabel}>Public review</span><div className={styles.detailReviewHeader}><strong>{detail.review?.rating}/5</strong><Status value={detail.review?.moderationStatus} /></div>
                  {detail.review?.title && <h3>{detail.review.title}</h3>}<p>{detail.review?.comment}</p>
                  {detail.review?.moderationReason && <p className={styles.policyNote}>Moderation reason: {humanize(detail.review.moderationReason)}</p>}
                </section>
                <section className={styles.detailCard}>
                  <span className={styles.detailLabel}>Private experience survey</span>
                  {detail.survey ? <div className={styles.surveyGrid}>{Object.entries(detail.survey).filter(([key]) => !["_id","__v","booking","tourist","guide","createdAt","updatedAt"].includes(key)).map(([key,value]) => <div key={key}><span>{humanize(key)}</span><strong>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value || "—")}</strong></div>)}</div> : <p className={styles.muted}>No private survey was submitted for this booking.</p>}
                </section>
              </div>
            ) : detailType === "cases" && detail ? (
              <div className={styles.drawerBody}>
                <section className={styles.detailCard}><span className={styles.detailLabel}>Case</span><div className={styles.detailReviewHeader}><strong>{humanize(detail.case?.type)}</strong><Status value={detail.case?.status} /></div><p>{detail.case?.report}</p></section>
                <section className={styles.detailCard}><span className={styles.detailLabel}>Booking evidence</span>{detail.booking ? <div className={styles.detailFacts}><span>Booking <strong>{humanize(detail.booking.status)}</strong></span><span>Payment <strong>{humanize(detail.booking.paymentStatus)}</strong></span><span>Attendance <strong>{humanize(detail.booking.attendance?.status || "booked")}</strong></span><span>Reference <strong>{idOf(detail.booking._id).slice(-10)}</strong></span></div> : <p className={styles.muted}>This case is not linked to a booking record.</p>}</section>
                <section className={styles.detailCard}><span className={styles.detailLabel}>Private survey</span>{detail.survey ? <div className={styles.surveyGrid}>{Object.entries(detail.survey).filter(([key]) => !["_id","__v","booking","tourist","guide","createdAt","updatedAt"].includes(key)).map(([key,value]) => <div key={key}><span>{humanize(key)}</span><strong>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value || "—")}</strong></div>)}</div> : <p className={styles.muted}>No private survey linked to this case.</p>}</section>
              </div>
            ) : <div className={styles.drawerState}>Unable to load this evidence.</div>}
          </aside>
        </div>
      )}

      {actionModal && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && closeAction()}>
          <section className={styles.modal} role="dialog" aria-modal="true">
            <header><div><span>Confirm admin action</span><h2>{actionModal.title}</h2></div><button type="button" onClick={closeAction} disabled={Boolean(busyKey)} aria-label="Close"><X size={18} /></button></header>
            <p>{actionModal.description}</p>
            {actionModal.reasonMode === "policy" && <label className={styles.field}><span>Policy reason</span><select value={policyReason} onChange={(event) => setPolicyReason(event.target.value)}><option value="">Select policy reason</option>{REVIEW_POLICY_REASONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><small>Negative sentiment or a low rating alone is not a moderation reason.</small></label>}
            {actionModal.reasonMode === "text" && <label className={styles.field}><span>Decision reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Document the evidence and reason for this decision…" /></label>}
            {actionModal.verificationKind === "license" && actionModal.action === "approve" && <label className={styles.field}><span>License expiry date</span><input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>}
            <footer><button type="button" className={styles.secondaryAction} onClick={closeAction} disabled={Boolean(busyKey)}>Cancel</button><button type="button" className={styles.confirmAction} onClick={submitAction} disabled={Boolean(busyKey)}>{busyKey ? "Working…" : actionModal.confirmLabel || "Confirm"}</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
