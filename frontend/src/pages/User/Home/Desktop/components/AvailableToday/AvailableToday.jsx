import styles from "./AvailableToday.module.css";
import { useNavigate } from "react-router-dom";
import { resolveUploadsUrl } from "../../../../../../services/api";
import { Clock, MapPin, ArrowRight, Zap } from "lucide-react";

import pyramids from "../../../../../../assets/images/explore/pyramids.jpg";
import museum from "../../../../../../assets/images/explore/the_grand_museum.webp";
import oldCairo from "../../../../../../assets/images/explore/old-cairo.jpg";

const defaultTours = [
  {
    id: 1,
    image: pyramids,
    title: "Pyramids Sunrise & Sphinx Experience",
    location: "Giza Plateau",
    time: "09:30 AM - 01:30 PM",
    price: "$45",
  },
  {
    id: 2,
    image: oldCairo,
    title: "Historic Cairo Walking Trip",
    location: "Old Cairo",
    time: "04:00 PM - 07:00 PM",
    price: "$35",
  },
  {
    id: 3,
    image: pyramids,
    title: "Nile Sunset Felucca Cruise",
    location: "Nile River, Cairo",
    time: "05:00 PM - 07:00 PM",
    price: "$25",
  },
  {
    id: 4,
    image: oldCairo,
    title: "Cairo Street Food Evening Feast",
    location: "Downtown Cairo",
    time: "06:00 PM - 09:00 PM",
    price: "$30",
  },
];

const getImgSrc = (img, fallback) => {
  if (!img) return fallback;
  return resolveUploadsUrl(img) || fallback;
};

function AvailableToday({ tours }) {
  const navigate = useNavigate();
  const displayTours = tours && tours.length > 0
    ? tours.map((t, idx) => ({
        id: t._id || idx,
        image: getImgSrc(t.image, [pyramids, museum, oldCairo][idx % 3]),
        title: t.title,
        location: t.location,
        time: t.duration || "Today, Immediate Entry",
        price: typeof t.price === "number" ? `$${t.price}` : t.price,
      }))
    : defaultTours;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.liveBadge}>
            <span className={styles.livePulseDot} />
            <Zap size={13} className={styles.zapIcon} />
            <span>Instant Departure</span>
          </div>
          <h2>Tours Available Today</h2>
          <p>
            Spontaneous adventures and last-minute slots ready for instant booking.
          </p>
        </div>

        <button className={styles.viewAllBtn} onClick={() => navigate("/user/available-today")}>
          <span>View All</span>
          <ArrowRight size={16} />
        </button>
      </div>

      <div className={styles.cards}>
        {displayTours.map((tour) => (
          <div
            key={tour.id}
            className={styles.card}
            onClick={() => navigate("/user/available-today")}
          >
            <div className={styles.cardImgContainer}>
              <img
                src={tour.image}
                alt={tour.title}
                className={styles.cardImg}
              />
              <div className={styles.badge}>
                <span className={styles.innerPulse} />
                <span>Today</span>
              </div>
            </div>

            <div className={styles.content}>
              <div className={styles.location}>
                <MapPin size={13} />
                <span>{tour.location}</span>
              </div>

              <h3 className={styles.title}>{tour.title}</h3>

              <div className={styles.timeInfo}>
                <Clock size={13} />
                <span>{tour.time}</span>
              </div>

              <div className={styles.footer}>
                <div className={styles.priceContainer}>
                  <small>From</small>
                  <strong>{tour.price}</strong>
                </div>

                <button
                  className={styles.bookBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (/^[a-f0-9]{24}$/i.test(String(tour.id))) {
                      navigate(`/user/trips/${tour.id}/book`);
                    } else {
                      navigate("/user/available-today");
                    }
                  }}
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AvailableToday;
