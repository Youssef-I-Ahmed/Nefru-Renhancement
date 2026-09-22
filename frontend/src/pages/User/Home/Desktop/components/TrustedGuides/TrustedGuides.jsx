import styles from "./TrustedGuides.module.css";
import { useNavigate } from "react-router-dom";
import { resolveUploadsUrl } from "../../../../../../services/api";
import { CheckCircle2, Star, Award, Languages, ArrowRight, ShieldCheck } from "lucide-react";

import guide1 from "../../../../../../assets/images/guiders/guide1.webp";
import guide2 from "../../../../../../assets/images/guiders/guide3.webp";
import guide3 from "../../../../../../assets/images/guiders/guide4.webp";

const defaultGuides = [
  {
    id: 1,
    name: "Mohamed Hassan",
    title: "Licensed Egyptologist",
    rating: "4.9",
    languages: "Arabic • English",
    experience: "8 Years Experience",
    image: guide1,
  },
  {
    id: 2,
    name: "Mariam El-Sayed",
    title: "Coptic & Islamic Heritage Specialist",
    rating: "4.8",
    languages: "Arabic • English • French",
    experience: "6 Years Experience",
    image: guide2,
  },
  {
    id: 3,
    name: "Omar Khalil",
    title: "Upper Egypt & Luxor Expert",
    rating: "5.0",
    languages: "Arabic • English • German",
    experience: "10 Years Experience",
    image: guide3,
  },
  {
    id: 4,
    name: "Salma Nassar",
    title: "Alexandria & Mediterranean Specialist",
    rating: "4.7",
    languages: "Arabic • English • Italian",
    experience: "5 Years Experience",
    image: guide1,
  },
];

const getImgSrc = (img, fallback) => {
  if (!img) return fallback;
  return resolveUploadsUrl(img) || fallback;
};

function TrustedGuides({ guides }) {
  const navigate = useNavigate();
  const displayGuides = guides && guides.length > 0
    ? guides.map((g, idx) => ({
        id: g._id || idx,
        name: g.fullName || g.name || "Local Guide",
        title: g.title || "Licensed Egyptologist",
        rating: g.rating ? String(g.rating) : "4.9",
        languages: Array.isArray(g.languages) && g.languages.length > 0
          ? g.languages.join(" • ")
          : (typeof g.languages === "string" ? g.languages : "Arabic • English"),
        experience: g.yearsExperience
          ? `${g.yearsExperience} Years Exp.`
          : (g.experience || "5 Years Exp."),
        image: getImgSrc(g.avatar || g.heroImage, [guide1, guide2, guide3][idx % 3]),
      }))
    : defaultGuides;

  return (
    <section id="top-guides" className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.subHeaderBadge}>
            <ShieldCheck size={14} />
            <span>Ministry of Tourism Licensed</span>
          </div>
          <h2>Trusted Local Guides</h2>
          <p>
            Connect with passionate, certified Egyptologists who bring ancient history to life.
          </p>
        </div>

        <button className={styles.viewAllBtn} onClick={() => navigate("/user/discover")}>
          <span>View All Guides</span>
          <ArrowRight size={16} />
        </button>
      </div>

      <div className={styles.grid}>
        {displayGuides.map((guide) => (
          <div
            key={guide.id}
            className={styles.card}
            onClick={() => navigate("/user/guideprofile")}
          >
            <div className={styles.imageWrapper}>
              <img
                src={guide.image}
                alt={guide.name}
                className={styles.guideImg}
              />
              <div className={styles.ratingBadge}>
                <Star size={12} fill="#EDAE49" color="#EDAE49" />
                <span>{guide.rating}</span>
              </div>
            </div>

            <div className={styles.guideContent}>
              <div className={styles.nameHeader}>
                <h3>{guide.name}</h3>
                <CheckCircle2 size={16} className={styles.verifiedIcon} />
              </div>

              <p className={styles.guideTitle}>{guide.title || "Licensed Egyptologist"}</p>

              <div className={styles.metaRow}>
                <div className={styles.metaItem}>
                  <Languages size={13} className={styles.metaIcon} />
                  <span>{guide.languages}</span>
                </div>
                <div className={styles.metaItem}>
                  <Award size={13} className={styles.metaIcon} />
                  <span>{guide.experience}</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.profileBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/user/guideprofile");
                }}
              >
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TrustedGuides;
