import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "./Operations.css";

export default function Operations({ role }) {
  const [data, setData] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [detail, setDetail] = useState(null);
  const admin = role === "admin",
    tourist = role === "tourist";
  const [expiryDate, setExpiryDate] = useState(""),
    [verificationKind, setVerificationKind] = useState("identity"),
    [closed, setClosed] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await apiRequest(
        tourist ? "/bookings/me" : "/marketplace/dashboard",
      );
      setData(response.data || {});
    } catch (e) {
      setError(e.message);
    }
  }, [tourist]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) load();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);
  async function act(path, payload = {}) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/marketplace/" + path, {
        method: "POST",
        body: JSON.stringify({ reason, ...payload }),
      });
      if (path.endsWith("/request_deletion")) setClosed(true);
      else await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const action = (label, path, payload) => (
    <button type="button" disabled={busy} onClick={() => act(path, payload)}>
      {label}
    </button>
  );
  const bookings = Array.isArray(data) ? data : data.bookings || [];
  if (closed)
    return (
      <main className="marketplace-operations">
        <h1>Account closure requested</h1>
        <p>
          Your account is disabled. Your bookings and financial history remain
          preserved while NEFRU resolves outstanding obligations.
        </p>
        <a href="/">Return to NEFRU</a>
      </main>
    );
  return (
    <main className="marketplace-operations">
      <header>
        <p>
          NEFRU ·{" "}
          {admin
            ? "Trust & safety"
            : tourist
              ? "Traveler support"
              : "Experience operations"}
        </p>
        <h1>
          {admin
            ? "Moderation & operations"
            : tourist
              ? "Attendance & account"
              : "Deliver your experiences"}
        </h1>
        <p>
          Published listings, booked experiences and moderation decisions have
          separate lifecycles.
        </p>
      </header>
      {error && (
        <p role="alert" className="operations-error">
          {error}
        </p>
      )}
      <label className="operations-reason">
        Reason / report
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Explain any rejection, restriction, cancellation or attendance issue."
        />
      </label>
      <button type="button" onClick={load} disabled={busy}>
        Refresh
      </button>
      {admin && (
        <section>
          <h2>Guide verification</h2>
          <p>
            Inspect private documents in Accounts before deciding. Activity
            licenses require a valid expiry date.
          </p>
          <Link to="/admin/accounts">Review identity documents</Link>
          <label>
            Review type
            <select
              value={verificationKind}
              onChange={(e) => setVerificationKind(e.target.value)}
            >
              <option value="identity">Identity</option>
              <option value="license">Activity license</option>
            </select>
          </label>
          <label>
            Document expiry
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </label>
          {(data.verifications || []).map((g) => (
            <article key={g._id}>
              <h3>{g.fullName}</h3>
              <p>
                Identity: {g.identityStatus || g.verificationStatus} · License:{" "}
                {g.licenseStatus}
              </p>
              {action(
                "Approve submitted document",
                `verification/${g.user}/actions/approve`,
                { kind: verificationKind, expiryDate },
              )}
              {action(
                "Reject with reason",
                `verification/${g.user}/actions/reject`,
                { kind: verificationKind },
              )}
            </article>
          ))}
        </section>
      )}
      {!admin && !tourist && (
        <details>
          <summary>Account closure</summary>
          <p>
            Closure disables normal access; NEFRU must separately resolve future
            bookings and unsettled earnings.
          </p>
          {action(
            "Request account deletion",
            "accounts/me/actions/request_deletion",
          )}
        </details>
      )}
      {tourist ? (
        <section>
          <h2>Your experiences</h2>
          {bookings.map((b) => (
            <article key={b.id}>
              <h3>{b.title}</h3>
              <p>
                {b.status} · Attendance: {b.attendance?.status || "booked"}
              </p>
              {["booked", "no_show"].includes(
                b.attendance?.status || "booked",
              ) &&
                action(
                  "Report attendance issue",
                  `bookings/${b.id}/attendance/dispute`,
                )}
              <Link to="/user/profile/reviews">
                Reviews and private feedback
              </Link>
            </article>
          ))}
          <article>
            <h2>Account closure</h2>
            <p>
              Requesting deletion disables normal account use. Booking and
              financial history remain preserved while outstanding obligations
              are resolved.
            </p>
            {action(
              "Request account deletion",
              "accounts/me/actions/request_deletion",
            )}
          </article>
        </section>
      ) : (
        <>
          <section>
            <h2>Experiences</h2>
            {(data.trips || []).map((t) => (
              <article key={t._id}>
                <h3>{t.title}</h3>
                <p>
                  {t.lifecycleStatus} · {t.reviewStatus}
                </p>
                {!admin && (
                  <Link to={`/guide/tours/${t._id}/edit`}>
                    Edit draft / revision
                  </Link>
                )}
                <div className="operations-actions">
                  {!admin &&
                    t.lifecycleStatus === "draft" &&
                    ["not_submitted", "changes_requested"].includes(
                      t.reviewStatus,
                    ) &&
                    action("Submit", `trips/${t._id}/actions/submit`)}
                  {t.lifecycleStatus === "live" &&
                    action(
                      admin ? "Hide" : "Pause",
                      `trips/${t._id}/actions/${admin ? "hide" : "pause"}`,
                    )}
                  {!admin &&
                    t.lifecycleStatus === "paused_by_guide" &&
                    action("Resume", `trips/${t._id}/actions/resume`)}
                  {admin &&
                    t.lifecycleStatus === "hidden_by_admin" &&
                    action(
                      "Restore to paused",
                      `trips/${t._id}/actions/restore`,
                    )}
                  {admin &&
                    t.reviewStatus === "rejected" &&
                    action(
                      "Reopen with reason",
                      `trips/${t._id}/actions/reopen`,
                    )}
                  {admin &&
                    t.reviewStatus === "in_review" &&
                    ["approve", "request_changes", "reject"].map((a) => (
                      <span key={a}>
                        {action(
                          a.replaceAll("_", " "),
                          `trips/${t._id}/actions/${a}`,
                        )}
                      </span>
                    ))}
                  {admin &&
                    action(
                      t.featured ? "Remove feature" : "Feature",
                      `merchandising/trips/${t._id}`,
                      { featured: !t.featured },
                    )}
                  {t.lifecycleStatus !== "archived" &&
                    action("Archive", `trips/${t._id}/actions/archive`)}
                </div>
              </article>
            ))}
          </section>
          <section>
            <h2>Revisions</h2>
            {!(data.revisions || []).length && (
              <p>No revisions awaiting action.</p>
            )}
            {(data.revisions || []).map((r) => (
              <article key={r._id}>
                <h3>{r.content.title}</h3>
                <p>
                  {r.reviewStatus} · EGP {r.content.price} ·{" "}
                  {r.content.duration} · {r.content.location}
                </p>
                <p>{r.content.description}</p>
                <p>{r.reason}</p>
                {admin
                  ? ["approve", "request_changes", "reject"].map((a) => (
                      <span key={a}>
                        {action(
                          a.replaceAll("_", " "),
                          `revisions/${r._id}/actions/${a}`,
                        )}
                      </span>
                    ))
                  : ["draft", "changes_requested"].includes(r.reviewStatus) &&
                    action(
                      "Submit revision",
                      `revisions/${r._id}/actions/submit`,
                    )}
              </article>
            ))}
          </section>
          <section>
            {!admin && data.quality && (
              <article>
                <h2>Experience quality</h2>
                <p>
                  {data.quality.surveyCount} private surveys received.
                  Aggregates appear after five responses.
                </p>
                {data.quality.metrics &&
                  Object.entries(data.quality.metrics).map(([name, value]) => (
                    <p key={name}>
                      {name}:{" "}
                      {value === null
                        ? "No answers"
                        : Number(value).toFixed(1) + "/5"}
                    </p>
                  ))}
              </article>
            )}
            <h2>Scheduled experiences</h2>
            {(data.occurrences || []).map((o) => (
              <article key={o._id}>
                <h3>
                  {(data.trips || []).find((t) => t._id === o.trip)?.title ||
                    "Experience"}
                </h3>
                <p>
                  {new Date(o.startsAt).toLocaleString()} —{" "}
                  {new Date(o.endsAt).toLocaleTimeString()} · {o.status} ·
                  Capacity {o.capacity}
                </p>
                <div className="operations-actions">
                  {["upcoming", "check_in_open"].includes(o.status) && (
                    <>
                      {action(
                        "Start experience",
                        `occurrences/${o._id}/actions/start`,
                      )}
                      {action(
                        "Cancel occurrence",
                        `occurrences/${o._id}/actions/cancel`,
                      )}
                    </>
                  )}
                  {o.status === "in_progress" &&
                    action(
                      "End experience",
                      `occurrences/${o._id}/actions/end`,
                    )}
                </div>
                {bookings
                  .filter((b) => b.occurrence === o._id)
                  .map((b) => (
                    <div className="operations-roster" key={b._id}>
                      <span>
                        Traveler · {String(b.tourist).slice(-6)} ·{" "}
                        {b.attendance?.status || "booked"}
                      </span>
                      {!admin &&
                        o.status === "in_progress" &&
                        b.attendance?.status === "booked" && (
                          <>
                            {action(
                              "Check in",
                              `bookings/${b._id}/attendance/check_in`,
                            )}
                            {action(
                              "No show",
                              `bookings/${b._id}/attendance/no_show`,
                            )}
                          </>
                        )}
                    </div>
                  ))}
              </article>
            ))}
          </section>
          {admin && (
            <>
              <section>
                <h2>Public review moderation</h2>
                <p>
                  Authentic negative feedback is eligible for publication.
                  Rejection/hiding requires a policy code: spam, fake_content,
                  abuse, threats, personal_information, irrelevant, fraud,
                  prohibited_content, policy_violation.
                </p>
                {(data.reviews || []).map((r) => (
                  <article key={r._id}>
                    <h3>
                      {r.rating}/5 · {r.title}
                    </h3>
                    <p>{r.comment}</p>
                    <small>
                      {r.moderationStatus} ·{" "}
                      {r.isVerifiedBooking === true
                        ? "Verified experience"
                        : "Unverified / demo"}
                    </small>
                    <div className="operations-actions">
                      {r.moderationStatus === "pending_moderation" ? (
                        <>
                          {action(
                            "Publish",
                            `reviews/${r._id}/actions/publish`,
                          )}
                          {action("Reject", `reviews/${r._id}/actions/reject`)}
                        </>
                      ) : (
                        action("Hide", `reviews/${r._id}/actions/hide`)
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setDetail(
                              (
                                await apiRequest(
                                  `/marketplace/reviews/${r._id}`,
                                )
                              ).data,
                            );
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        Private survey & booking
                      </button>
                    </div>
                  </article>
                ))}
              </section>
              {detail && (
                <article>
                  <h2>Confidential review detail</h2>
                  <p>
                    Payment: {detail.booking?.paymentStatus} · Attendance:{" "}
                    {detail.booking?.attendance?.status}
                  </p>
                  {detail.survey ? (
                    Object.entries(detail.survey)
                      .filter(
                        ([key]) =>
                          ![
                            "_id",
                            "__v",
                            "booking",
                            "tourist",
                            "guide",
                            "createdAt",
                            "updatedAt",
                          ].includes(key),
                      )
                      .map(([key, value]) => (
                        <p key={key}>
                          <strong>{key}</strong>: {String(value)}
                        </p>
                      ))
                  ) : (
                    <p>No private survey submitted.</p>
                  )}
                  <button onClick={() => setDetail(null)}>Close</button>
                </article>
              )}
              <section>
                <h2>Operational cases</h2>
                {(data.cases || []).map((c) => (
                  <article key={c._id}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setDetail(
                            (await apiRequest(`/marketplace/cases/${c._id}`))
                              .data,
                          );
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Inspect confidential evidence
                    </button>
                    <h3>{c.type.replaceAll("_", " ")}</h3>
                    <p>{c.report}</p>
                    {c.type === "attendance_dispute" ? (
                      <>
                        {action("Resolve: attended", `cases/${c._id}/resolve`, {
                          attendance: "checked_in",
                        })}
                        {action("Resolve: no show", `cases/${c._id}/resolve`, {
                          attendance: "no_show",
                        })}
                      </>
                    ) : (
                      action(
                        "Resolve after investigation",
                        `cases/${c._id}/resolve`,
                      )
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
