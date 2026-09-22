import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveMediaUrl } from "../../../../services/api";
import {
  banUser,
  deleteUser,
  getAccountReview,
  getAccounts,
  getVerificationDocument,
  reviewGuideVerification,
  unbanUser,
} from "../../api";
import styles from "./Accounts.module.css";

const ROLE_TABS = [
  { value: "tourist", label: "Travelers" },
  { value: "guide", label: "Guides" },
  { value: "admin", label: "Admins" },
];

const STATUS_LABELS = {
  active: "Active",
  pending: "Pending",
  deactivated: "Suspended",
};

const VERIFICATION_LABELS = {
  draft: "Not submitted",
  pending: "Awaiting review",
  approved: "Verified",
  rejected: "Changes needed",
};

const DOCUMENT_LABELS = {
  national_id: "National ID",
  passport: "Passport",
  guide_license: "Guide license",
};

function initials(value = "NE") {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusPill({ value, kind = "account" }) {
  const label = kind === "verification"
    ? VERIFICATION_LABELS[value] || "Not submitted"
    : STATUS_LABELS[value] || value || "Unknown";
  return (
    <span className={styles.statusPill} data-status={value || "draft"} data-kind={kind}>
      {label}
    </span>
  );
}

function Avatar({ account, size = "normal" }) {
  const [failed, setFailed] = useState(false);
  const url = resolveMediaUrl(account?.avatar || "");
  const name = account?.fullName || account?.email || "Nefru";

  return (
    <span className={styles.avatar} data-size={size}>
      {url && !failed ? (
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}

function RejectModal({ detail, onClose, onSubmit, busy }) {
  const documents = detail?.verification?.documents || [];
  const [reason, setReason] = useState("");
  const [changes, setChanges] = useState({});
  const [error, setError] = useState("");

  const toggle = (documentType) => {
    setChanges((current) => {
      if (current[documentType] !== undefined) {
        const next = { ...current };
        delete next[documentType];
        return next;
      }
      return { ...current, [documentType]: "Please upload a clearer replacement." };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 8) {
      setError("Write a clear reason with at least 8 characters.");
      return;
    }
    const requestedChanges = Object.entries(changes)
      .filter(([, message]) => message.trim().length >= 3)
      .map(([documentType, message]) => ({ documentType, message: message.trim() }));
    await onSubmit({
      action: "reject",
      rejectionReason: reason.trim(),
      requestedChanges,
    });
  };

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <form className={styles.modal} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Verification review</span>
            <h2>Request changes</h2>
            <p>Explain what must be corrected before this guide can resubmit.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <label className={styles.modalField}>
          <span>General reason</span>
          <textarea
            rows="4"
            maxLength="500"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
            placeholder="Example: The identity document is difficult to read and the license image is incomplete."
          />
          <small>{reason.length}/500</small>
        </label>

        {documents.length > 0 && (
          <section className={styles.changeList}>
            <div>
              <strong>Document-specific changes</strong>
              <small>Optional. Select any document that must be replaced.</small>
            </div>
            {documents.map((document) => {
              const selected = changes[document.documentType] !== undefined;
              return (
                <div className={styles.changeRow} key={document.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(document.documentType)}
                    />
                    <span>{DOCUMENT_LABELS[document.documentType] || document.documentType}</span>
                  </label>
                  {selected && (
                    <input
                      value={changes[document.documentType]}
                      onChange={(event) =>
                        setChanges((current) => ({
                          ...current,
                          [document.documentType]: event.target.value,
                        }))
                      }
                      maxLength="500"
                    />
                  )}
                </div>
              );
            })}
          </section>
        )}

        {error && <p className={styles.modalError}>{error}</p>}
        <footer>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.dangerPrimary} disabled={busy}>
            <XCircle size={17} /> {busy ? "Saving…" : "Return for changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default function Accounts() {
  const [role, setRole] = useState("tourist");
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [verification, setVerification] = useState("all");
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(query.trim());
      setPage(1);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await getAccounts({ role, page, query: searchTerm, status, verification });
    if (result.error) {
      setError(result.error);
      setAccounts([]);
    } else {
      setAccounts(result.data?.accounts || []);
      setMeta(result.meta || null);
    }
    setLoading(false);
  }, [role, page, searchTerm, status, verification]);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setActionError("");
    const result = await getAccountReview(id);
    if (result.error) {
      setActionError(result.error);
      setDetail(null);
    } else {
      setDetail(result.data || null);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadAccounts, 0);
    return () => clearTimeout(timer);
  }, [loadAccounts]);

  useEffect(() => {
    const timer=setTimeout(()=>loadDetail(selectedId),0);
    return ()=>clearTimeout(timer);
  }, [selectedId, loadDetail]);

  const [previousAccounts, setPreviousAccounts] = useState(accounts);
  if(previousAccounts !== accounts) {
    setPreviousAccounts(accounts);
    if(selectedId && !accounts.some(account=>account.id===selectedId)) {setSelectedId("");setDetail(null);}
  }

  const stats = useMemo(
    () => ({
      travelers: meta?.roleCounts?.tourist ?? "—",
      guides: meta?.roleCounts?.guide ?? "—",
      pending: meta?.pendingVerification ?? "—",
      suspended: meta?.deactivatedCount ?? "—",
    }),
    [meta],
  );

  const refreshAfterAction = async (message) => {
    setActionMessage(message || "Updated successfully.");
    await Promise.all([loadAccounts(), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
  };

  const runAction = async (action) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await action();
      if (result?.error) {
        setActionError(result.error);
        return false;
      }
      await refreshAfterAction(result?.message);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setPage(1);
    setStatus("all");
    setVerification("all");
    setSelectedId("");
    setDetail(null);
    setActionMessage("");
  };

  const handleApprove = () =>
    runAction(() => reviewGuideVerification(selectedId, { action: "approve" }));

  const handleReject = async (payload) => {
    const ok = await runAction(() => reviewGuideVerification(selectedId, payload));
    if (ok) setShowReject(false);
  };

  const handleAccountState = () => {
    const account = detail?.account;
    if (!account || account.role === "admin") return;
    const suspended = account.status === "deactivated";
    return runAction(() => (suspended ? unbanUser(account.id) : banUser(account.id)));
  };

  const handleDelete = async () => {
    const account = detail?.account;
    if (!account || account.role === "admin") return;
    if (!window.confirm(`Delete ${account.email}? This permanently removes account-related platform data.`)) return;
    const ok = await runAction(() => deleteUser(account.id));
    if (ok) {
      setSelectedId("");
      setDetail(null);
    }
  };

  const openDocument = async (document) => {
    setActionError("");
    try {
      const blob = await getVerificationDocument(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (documentError) {
      setActionError(documentError.message || "Unable to open document");
    }
  };

  const account = detail?.account;
  const profile = detail?.profile;
  const verificationDetail = detail?.verification;
  const canReview = account?.role === "guide" && profile?.verificationStatus === "pending";

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>People & trust</span>
          <h1>Accounts</h1>
          <p>Manage travelers and guides, review verification documents, and protect platform access.</p>
        </div>
        <button type="button" onClick={loadAccounts} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <section className={styles.metrics}>
        <article><span><UsersRound size={19} /></span><div><small>Travelers</small><strong>{stats.travelers}</strong></div></article>
        <article><span><UserRound size={19} /></span><div><small>Guides</small><strong>{stats.guides}</strong></div></article>
        <article><span><FileCheck2 size={19} /></span><div><small>Awaiting verification</small><strong>{stats.pending}</strong></div></article>
        <article><span><Ban size={19} /></span><div><small>Suspended accounts</small><strong>{stats.suspended}</strong></div></article>
      </section>

      {error && <p className={styles.errorBanner}>{error}</p>}
      {actionMessage && <p className={styles.successBanner}>{actionMessage}</p>}
      {actionError && <p className={styles.errorBanner}>{actionError}</p>}

      <section className={styles.workspace} data-detail={selectedId ? "open" : "closed"}>
        <div className={styles.listPanel}>
          <div className={styles.roleTabs}>
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                data-active={role === tab.value || undefined}
                onClick={() => handleRoleChange(tab.value)}
              >
                {tab.label}
                <span>{meta?.roleCounts?.[tab.value] ?? "—"}</span>
              </button>
            ))}
          </div>

          <div className={styles.filters}>
            <label className={styles.searchBox}>
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or email"
              />
            </label>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="all">All account states</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="deactivated">Suspended</option>
            </select>
            {role === "guide" && (
              <select value={verification} onChange={(event) => { setVerification(event.target.value); setPage(1); }}>
                <option value="all">All verification</option>
                <option value="pending">Awaiting review</option>
                <option value="approved">Verified</option>
                <option value="rejected">Changes needed</option>
                <option value="draft">Not submitted</option>
              </select>
            )}
          </div>

          <div className={styles.tableHeader}>
            <span>Account</span><span>Joined</span><span>Status</span>{role === "guide" && <span>Verification</span>}<span />
          </div>

          <div className={styles.accountList}>
            {loading ? (
              <div className={styles.emptyState}>Loading accounts…</div>
            ) : accounts.length === 0 ? (
              <div className={styles.emptyState}>No accounts match these filters.</div>
            ) : (
              accounts.map((item) => (
                <button
                  type="button"
                  className={styles.accountRow}
                  data-selected={item.id === selectedId || undefined}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={styles.accountIdentity}>
                    <Avatar account={item} />
                    <span><strong>{item.fullName || "Name not added"}</strong><small>{item.email}</small></span>
                  </span>
                  <time>{formatDate(item.createdAt)}</time>
                  <StatusPill value={item.status} />
                  {role === "guide" && <StatusPill value={item.verificationStatus} kind="verification" />}
                  <ChevronRight size={17} />
                </button>
              ))
            )}
          </div>

          <footer className={styles.pagination}>
            <span>{meta ? `${meta.totalRecords} account${meta.totalRecords === 1 ? "" : "s"}` : ""}</span>
            <div>
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft size={17} /></button>
              <strong>{page} / {meta?.totalPages || 1}</strong>
              <button type="button" disabled={page >= (meta?.totalPages || 1) || loading} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
            </div>
          </footer>
        </div>

        {selectedId && (
          <aside className={styles.detailPanel}>
            {detailLoading ? (
              <div className={styles.emptyState}>Loading account details…</div>
            ) : !detail ? (
              <div className={styles.emptyState}>Account details are unavailable.</div>
            ) : (
              <>
                <header className={styles.detailHeader}>
                  <button type="button" className={styles.closeDetail} onClick={() => setSelectedId("")} aria-label="Close details"><X size={18} /></button>
                  <Avatar account={{ ...account, ...profile }} size="large" />
                  <div>
                    <span>{account.role}</span>
                    <h2>{profile?.fullName || account.email}</h2>
                    <p>{account.email}</p>
                  </div>
                </header>

                <div className={styles.detailScroll}>
                  <section className={styles.detailCard}>
                    <div className={styles.cardTitle}><UserRound size={17} /><strong>Account details</strong></div>
                    <dl>
                      <div><dt>Status</dt><dd><StatusPill value={account.status} /></dd></div>
                      <div><dt>Email</dt><dd>{account.email}</dd></div>
                      <div><dt>Email verified</dt><dd>{account.emailVerified ? "Yes" : "No"}</dd></div>
                      <div><dt>Joined</dt><dd>{formatDate(account.createdAt)}</dd></div>
                      <div><dt>Bookings</dt><dd>{detail.activity?.bookings ?? 0}</dd></div>
                      {account.role === "guide" && <div><dt>Tours</dt><dd>{detail.activity?.tours ?? 0}</dd></div>}
                    </dl>
                  </section>

                  {account.role === "guide" && (
                    <>
                      <section className={styles.detailCard}>
                        <div className={styles.cardTitle}><BadgeCheck size={17} /><strong>Guide profile</strong></div>
                        <div className={styles.profileSummary}>
                          <div><MapPin size={15} /><span>{profile?.location || "Location not added"}</span></div>
                          <div><Star size={15} /><span>{Number(profile?.rating || 0).toFixed(1)} · {profile?.reviewsCount || 0} reviews</span></div>
                          <div><Clock3 size={15} /><span>{profile?.yearsExperience || 0} years experience</span></div>
                        </div>
                        {profile?.headline && <p className={styles.profileHeadline}>{profile.headline}</p>}
                        {profile?.languages?.length > 0 && <p className={styles.tagLine}><strong>Languages</strong>{profile.languages.join(" · ")}</p>}
                        {profile?.specialties?.length > 0 && <p className={styles.tagLine}><strong>Specialties</strong>{profile.specialties.join(" · ")}</p>}
                      </section>

                      <section className={styles.detailCard}>
                        <div className={styles.cardTitleRow}>
                          <div className={styles.cardTitle}><ShieldCheck size={17} /><strong>Verification</strong></div>
                          <StatusPill value={profile?.verificationStatus} kind="verification" />
                        </div>
                        <div className={styles.verificationDates}>
                          <span>Submitted <strong>{formatDate(verificationDetail?.submittedAt, "Not yet")}</strong></span>
                          <span>Reviewed <strong>{formatDate(verificationDetail?.reviewedAt, "Not yet")}</strong></span>
                        </div>

                        {profile?.rejectionReason && (
                          <div className={styles.reviewNotice}><ShieldAlert size={17} /><span><strong>Last review note</strong>{profile.rejectionReason}</span></div>
                        )}

                        <div className={styles.documentList}>
                          {(verificationDetail?.documents || []).length === 0 ? (
                            <p className={styles.mutedText}>No verification documents uploaded.</p>
                          ) : (
                            verificationDetail.documents.map((document) => (
                              <div className={styles.documentRow} key={document.id}>
                                <span className={styles.documentIcon}><FileText size={18} /></span>
                                <span><strong>{DOCUMENT_LABELS[document.documentType] || document.documentType}</strong><small>{document.originalName} · {formatDate(document.uploadedAt)}</small></span>
                                <button type="button" onClick={() => openDocument(document)}><ExternalLink size={15} /> Open</button>
                              </div>
                            ))
                          )}
                        </div>

                        {(verificationDetail?.requestedChanges || []).length > 0 && (
                          <div className={styles.requestedChanges}>
                            <strong>Requested changes</strong>
                            {verificationDetail.requestedChanges.slice().reverse().map((change) => (
                              <div key={change.id} data-resolved={Boolean(change.resolvedAt) || undefined}>
                                <span>{DOCUMENT_LABELS[change.documentType] || change.documentType}</span>
                                <p>{change.message}</p>
                                <small>{change.resolvedAt ? `Updated ${formatDate(change.resolvedAt)}` : "Waiting for replacement"}</small>
                              </div>
                            ))}
                          </div>
                        )}

                        {canReview && (
                          <div className={styles.reviewActions}>
                            <button type="button" className={styles.approveButton} onClick={handleApprove} disabled={busy}>
                              <CheckCircle2 size={17} /> {busy ? "Working…" : "Approve verification"}
                            </button>
                            <button type="button" className={styles.requestButton} onClick={() => setShowReject(true)} disabled={busy}>
                              <XCircle size={17} /> Request changes
                            </button>
                          </div>
                        )}
                      </section>
                    </>
                  )}

                  <section className={styles.detailCard}>
                    <div className={styles.cardTitle}><ShieldAlert size={17} /><strong>Access control</strong></div>
                    {account.role === "admin" ? (
                      <p className={styles.mutedText}>Admin accounts are protected from suspend and delete actions here.</p>
                    ) : (
                      <>
                        <p className={styles.mutedText}>
                          Suspending blocks sign-in without deleting historical data. Delete is permanent.
                        </p>
                        <div className={styles.accountActions}>
                          <button type="button" className={styles.secondaryButton} onClick={handleAccountState} disabled={busy}>
                            <Ban size={16} /> {account.status === "deactivated" ? "Reactivate account" : "Suspend account"}
                          </button>
                          <button type="button" className={styles.deleteButton} onClick={handleDelete} disabled={busy}>
                            <Trash2 size={16} /> Delete account
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                </div>
              </>
            )}
          </aside>
        )}
      </section>

      {showReject && detail && (
        <RejectModal
          detail={detail}
          onClose={() => setShowReject(false)}
          onSubmit={handleReject}
          busy={busy}
        />
      )}
    </div>
  );
}
