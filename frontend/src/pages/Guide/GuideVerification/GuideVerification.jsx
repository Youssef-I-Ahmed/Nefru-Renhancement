import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  FileUp,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { apiRequest } from "../../../services/api";
import { updateProfile } from "../../../store/slices/authSlice";
import styles from "./GuideVerification.module.css";

const DOCUMENT_LABELS = {
  national_id: "National ID",
  passport: "Passport",
  guide_license: "Guide license",
};

const STATUS_COPY = {
  draft: {
    title: "Complete your verification",
    text: "Upload a National ID or passport, then submit your application for review.",
  },
  pending: {
    title: "Application under review",
    text: "Your documents are locked while the NEFRU team reviews your application.",
  },
  approved: {
    title: "Guide verified",
    text: "Your guide account is approved and can access the guide workspace.",
  },
  rejected: {
    title: "Changes requested",
    text: "Replace the requested document, then resubmit your application.",
  },
};

export default function GuideVerification() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, profile } = useSelector((state) => state.auth);
  const [verification, setVerification] = useState(null);
  const [documentType, setDocumentType] = useState("national_id");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadVerification = useCallback(async () => {
    setError("");
    try {
      const response = await apiRequest("/guide-verification/me");
      setVerification(response.data.verification);
    } catch (requestError) {
      setError(requestError.message || "Unable to load verification details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadVerification, 0);
    return () => clearTimeout(timer);
  }, [loadVerification]);

  const status = verification?.verificationStatus || "draft";
  const canEditDocuments = verification?.canEditDocuments === true;
  const identityUploaded = useMemo(
    () => verification?.documents?.some((document) => ["national_id", "passport"].includes(document.documentType)),
    [verification],
  );
  const copy = STATUS_COPY[status] || STATUS_COPY.draft;

  const syncProfileStatus = (verificationStatus) => {
    dispatch(updateProfile({
      user,
      profile: { ...profile, verificationStatus, rejectionReason: "" },
    }));
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Choose a document first.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const existingDocument = verification?.documents?.find((document) => document.documentType === documentType);
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);
      const endpoint = existingDocument
        ? `/guide-verification/documents/${existingDocument.id}`
        : "/guide-verification/documents";
      const response = await apiRequest(endpoint, {
        method: existingDocument ? "PATCH" : "POST",
        body: formData,
      });
      setFile(null);
      setSuccess(response.message || "Document saved.");
      await loadVerification();
    } catch (requestError) {
      setError(requestError.message || "Unable to upload the document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (kind = "identity") => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const endpoint = status === "rejected" ? "/guide-verification/resubmit" : "/guide-verification/submit";
      const response = await apiRequest(endpoint, { method: "POST", body: JSON.stringify({ kind }) });
      syncProfileStatus(response.data.verificationStatus);
      await loadVerification();
      if (response.data.verificationStatus === "pending") navigate("/guide/application-received");
    } catch (requestError) {
      setError(requestError.message || "Unable to submit the application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading verification details…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Guide trust & safety</span>
          <h1>Verification</h1><p>Identity: {verification?.identityStatus || status} · License: {verification?.licenseStatus || "not submitted"}</p>{canEditDocuments && verification?.documents?.some(d => d.documentType === "guide_license") && <button disabled={submitting} onClick={() => handleSubmit("license")}>Submit / renew activity license</button>}
          <p>Your identity documents are reviewed separately from your public guide profile.</p>
        </div>
        <button type="button" onClick={loadVerification}><RefreshCw size={16} /> Refresh</button>
      </header>

      <section className={styles.statusCard} data-status={status}>
        <span className={styles.statusIcon}>
          {status === "approved" ? <BadgeCheck /> : status === "rejected" ? <AlertCircle /> : <ShieldCheck />}
        </span>
        <div>
          <small>Current status</small>
          <h2>{copy.title}</h2>
          <p>{copy.text}</p>
          {verification?.rejectionReason && <strong>{verification.rejectionReason}</strong>}
        </div>
        <b>{status.replaceAll("_", " ")}</b>
      </section>

      {verification?.requestedChanges?.length > 0 && (
        <section className={styles.card}>
          <div className={styles.sectionTitle}><AlertCircle /><div><h2>Requested changes</h2><p>Complete every unresolved request before resubmitting.</p></div></div>
          <div className={styles.changeList}>
            {verification.requestedChanges.map((change) => (
              <div key={change.id} data-resolved={Boolean(change.resolvedAt) || undefined}>
                <strong>{DOCUMENT_LABELS[change.documentType] || change.documentType}</strong>
                <span>{change.message}</span>
                <small>{change.resolvedAt ? "Updated" : "Action needed"}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.sectionTitle}><FileCheck2 /><div><h2>Your documents</h2><p>A National ID or passport is required. Guide license is optional unless the review team asks for it.</p></div></div>
          {verification?.documents?.length > 0 ? (
            <div className={styles.documentList}>
              {verification.documents.map((document) => (
                <article key={document.id}>
                  <span><FileCheck2 /></span>
                  <div><strong>{DOCUMENT_LABELS[document.documentType] || document.documentType}</strong><p>{document.originalName}</p><small>Uploaded {new Date(document.uploadedAt).toLocaleDateString()}</small></div>
                  <b>{document.replacedAt ? "Replaced" : "Stored"}</b>
                </article>
              ))}
            </div>
          ) : <div className={styles.empty}>No verification documents uploaded yet.</div>}
        </section>

        <aside className={styles.requirementsCard}>
          <h2>Before you submit</h2>
          <div data-complete={identityUploaded || undefined}><CheckCircle2 /><span><strong>Identity document</strong><small>National ID or passport</small></span></div>
          <div data-complete={verification?.documents?.some((document) => document.documentType === "guide_license") || undefined}><CheckCircle2 /><span><strong>Guide license</strong><small>Optional unless requested</small></span></div>
          <p>Only authorized guide/admin flows can retrieve stored verification files. They are not part of your public profile.</p>
        </aside>
      </div>

      {canEditDocuments && (
        <section className={styles.card}>
          <div className={styles.sectionTitle}><FileUp /><div><h2>{status === "rejected" ? "Replace a document" : "Upload a document"}</h2><p>Accepted: JPG, PNG, or PDF. Use a clear, readable file.</p></div></div>
          <div className={styles.uploadGrid}>
            <label><span>Document type</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="national_id">National ID</option><option value="passport">Passport</option><option value="guide_license">Guide license</option></select></label>
            <label><span>File</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            <button type="button" onClick={handleUpload} disabled={submitting || !file}>{submitting ? "Saving…" : verification?.documents?.some((document) => document.documentType === documentType) ? "Replace document" : "Upload document"}</button>
          </div>
        </section>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {canEditDocuments && (
        <div className={styles.submitBar}>
          <div><strong>{status === "rejected" ? "Ready to resubmit?" : "Ready for review?"}</strong><span>NEFRU will lock document editing while the application is pending.</span></div>
          <button type="button" onClick={() => handleSubmit("identity")} disabled={submitting || !identityUploaded}>{status === "rejected" ? "Resubmit for review" : "Submit for review"}</button>
        </div>
      )}
    </div>
  );
}
