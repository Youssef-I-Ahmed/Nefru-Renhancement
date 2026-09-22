import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Check, Mail, Save, UserRound } from "lucide-react";

import { apiRequest, resolveMediaUrl } from "../../../../../services/api";
import { updateProfile } from "../../../../../store/slices/authSlice";
import styles from "./EditProfilePremium.module.css";

function getInitials(fullName = "Traveler") {
  return fullName.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function dateForInput(value) {
  if (!value) return "";
  return String(value).split("T")[0];
}

export default function EditProfile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, profile } = useSelector((state) => state.auth || {});
  const fileInputRef = useRef(null);

  const initialData = useMemo(() => ({
    fullName: profile?.fullName || "",
    phoneNumber: profile?.phoneNumber || "",
    dateOfBirth: dateForInput(profile?.dateOfBirth),
    gender: profile?.gender || "other",
    nationality: profile?.nationality || "",
    preferredLanguage: profile?.preferredLanguage || "en",
  }), [profile]);

  const [formData, setFormData] = useState(initialData);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile?.avatar ? resolveMediaUrl(profile.avatar) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be smaller than 5 MB.");
      return;
    }
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let response = await apiRequest("/users/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          ...formData,
          fullName: formData.fullName.trim(),
          phoneNumber: formData.phoneNumber.trim(),
          nationality: formData.nationality.trim(),
          dateOfBirth: formData.dateOfBirth || null,
        }),
      });

      if (avatarFile) {
        const body = new FormData();
        body.append("avatar", avatarFile);
        response = await apiRequest("/users/profile/avatar", { method: "POST", body });
      }

      dispatch(updateProfile({ user: response.data.user, profile: response.data.profile }));
      navigate("/user/profile", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.pageContent}>
      <header className={styles.pageHeader}>
        <div><span>Profile details</span><h2>Edit your traveler profile</h2><p>These details belong to the account holder who makes the booking.</p></div>
      </header>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <section className={styles.photoSection}>
          <div className={styles.photoWrap}>
            {previewUrl ? <img src={previewUrl} alt={formData.fullName || "Traveler"} /> : <span>{getInitials(formData.fullName)}</span>}
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Change profile photo"><Camera size={17} /></button>
          </div>
          <div><h3>Profile photo</h3><p>JPG, PNG or WebP. Maximum 5 MB.</p><button type="button" className={styles.textButton} onClick={() => fileInputRef.current?.click()}>Choose photo</button></div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} hidden />
        </section>

        {error && <div className={styles.errorBox}>{error}</div>}

        <section className={styles.formSection}>
          <div className={styles.sectionTitle}><UserRound size={18} /><div><h3>Personal information</h3><p>Used for your traveler profile and bookings.</p></div></div>
          <div className={styles.formGrid}>
            <label><span>Full name</span><input name="fullName" value={formData.fullName} onChange={handleChange} autoComplete="name" required /></label>
            <label><span>Phone number</span><input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} autoComplete="tel" placeholder="+20 ..." /></label>
            <label><span>Date of birth</span><input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} /></label>
            <label><span>Gender</span><select name="gender" value={formData.gender} onChange={handleChange}><option value="male">Male</option><option value="female">Female</option><option value="other">Prefer not to say</option></select></label>
            <label><span>Nationality</span><input name="nationality" value={formData.nationality} onChange={handleChange} placeholder="e.g. Egyptian" /></label>
            <label><span>Preferred language</span><select name="preferredLanguage" value={formData.preferredLanguage} onChange={handleChange}><option value="en">English</option><option value="ar">Arabic</option><option value="tr">Turkish</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option></select></label>
          </div>
        </section>

        <section className={styles.emailSection}>
          <Mail size={18} />
          <div><span>Account email</span><strong>{user?.email || ""}</strong><p>Your email is managed through sign-in & security, not traveler profile details.</p></div>
          {user?.emailVerified && <span className={styles.verified}><Check size={14} /> Verified</span>}
        </section>

        <div className={styles.actions}>
          <Link to="/user/profile" className={styles.secondaryButton}>Cancel</Link>
          <button type="submit" className={styles.primaryButton} disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
