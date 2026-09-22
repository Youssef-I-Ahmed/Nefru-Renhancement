import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { normalizeTripSchedule, occurrenceDateTime } from "../../utils/tripSchedule.js";

export const DEMO_DATABASE = "nefru_portfolio_demo";
export const DEMO_NOTICE = "Portfolio demo: fictional experience and feedback; not a real reservation or endorsement.";
export const DEMO_MEDIA = Object.freeze({
  cairo: "https://res.cloudinary.com/w30patrt/image/upload/v1790034624/cairo.jpg",
  giza: "https://res.cloudinary.com/w30patrt/image/upload/v1790034117/giza.png",
  luxor: "https://res.cloudinary.com/w30patrt/image/upload/v1790034627/luxor.jpg",
  aswan: "https://res.cloudinary.com/w30patrt/image/upload/v1790034624/aswan.jpg",
  alexandria: "https://res.cloudinary.com/w30patrt/image/upload/v1790034620/alexandria.jpg",
  siwa: "https://res.cloudinary.com/w30patrt/image/upload/v1790034629/siwa.jpg",
});
// Admin-curated demo placement, independent of ratings and review evidence.
export const FEATURED_DEMO_TRIPS = ["pyramids", "grand-museum", "old-cairo", "valley-kings", "felucca", "alexandria"];
const eveningStarts = { "old-cairo": 17, "cairo-tastes": 18, felucca: 16, alexandria: 16 };
export const destinations = [
  { key: "cairo", name: "Cairo", lat: 30.0444, lng: 31.2357 },
  { key: "giza", name: "Giza", lat: 29.9792, lng: 31.1342 },
  { key: "luxor", name: "Luxor", lat: 25.6872, lng: 32.6396 },
  { key: "aswan", name: "Aswan", lat: 24.0889, lng: 32.8998 },
  { key: "alexandria", name: "Alexandria", lat: 31.2001, lng: 29.9187 },
  { key: "siwa", name: "Siwa", lat: 29.2032, lng: 25.5195 },
];

const experiences = [
  ["pyramids", "Giza Pyramids Experience", "giza", 2500, 4, "History", "Explore the pyramid plateau, panoramic viewpoints and the story of the Sphinx."],
  ["grand-museum", "Grand Egyptian Museum Tour", "giza", 2200, 3, "History", "Discover ancient craftsmanship through a carefully paced museum itinerary."],
  ["old-cairo", "Old Cairo Walking Tour", "cairo", 1200, 3, "Culture", "Walk historic lanes and courtyards with time for architecture and local stories."],
  ["cairo-tastes", "Cairo Culinary Discovery", "cairo", 1600, 3, "Food", "Discover traditional Egyptian dishes on a small-group neighborhood food walk."],
  ["valley-kings", "Luxor Valley of Kings", "luxor", 3200, 5, "History", "Explore the west bank and the landscape of ancient royal tombs."],
  ["karnak", "Karnak and Luxor Temples", "luxor", 2400, 4, "History", "Discover monumental columns, ceremonial avenues and the stories of Thebes."],
  ["felucca", "Aswan Nile Felucca", "aswan", 1400, 2, "Culture", "Enjoy a relaxed Nile sailing itinerary with island views and local storytelling."],
  ["philae", "Philae Island Heritage", "aswan", 2300, 3, "History", "Explore island architecture and the history of the temple complex."],
  ["alexandria", "Alexandria Heritage Tour", "alexandria", 2100, 4, "Culture", "Follow the Mediterranean waterfront and discover the city's layered history."],
  ["siwa", "Siwa Oasis Adventure", "siwa", 3500, 5, "Adventure", "Explore oasis scenery, traditional architecture and desert viewpoints."],
];

export const DEMO_TRIP_DESTINATIONS = Object.freeze(Object.fromEntries(
  experiences.map(([key, , city]) => [`trip:${key}`, city]),
));

export function demoId(key) {
  return new mongoose.Types.ObjectId(createHash("sha256").update(`${DEMO_DATABASE}:v1:${key}`).digest("hex").slice(0, 24));
}

function dateKey(now, days) {
  const cairoToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const date = new Date(`${cairoToday}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function demoSchedule(key, hours, capacity, now) {
  const dates = [0, 1, 2, 3, 4, 5, 6, 7, 14, 21, 28].map(days => dateKey(now, days));
  const slotsByDate = {};
  for (const date of dates) {
    const starts = [9, eveningStarts[key]].filter(hour => hour !== undefined);
    slotsByDate[date] = starts.map(hour => ({
      id: `${key}-${hour === 9 ? "morning" : "evening"}`,
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + hours).padStart(2, "0")}:00`, capacity,
    })).filter(slot => occurrenceDateTime(date, slot.startTime) > now);
  }
  return normalizeTripSchedule({ dates: dates.filter(date => slotsByDate[date].length), slotsByDate }, capacity);
}

// No network access, uploads, credentials or writes. Password hashes are supplied by the runner.
export function buildDemoFixtures({ adminEmail, passwordHashes, now = new Date() }) {
  const rows = [];
  const add = (model, key, identity, data) => {
    const document = { _id: demoId(key), ...data };
    rows.push({ model, key, identity, document });
    return document;
  };
  add("User", "admin", { email: adminEmail, role: "admin" }, {
    email: adminEmail, password: passwordHashes.admin, role: "admin", status: "active",
    authProviders: ["local"], emailVerified: true,
  });
  const tourists = [1, 2, 3].map(number => {
    const email = `tourist${number}@demo.example.com`;
    const user = add("User", `tourist:${number}`, { email, role: "tourist" }, {
      email, password: passwordHashes.tourist, role: "tourist", status: "active",
      authProviders: ["local"], emailVerified: true,
      roleProfile: "TouristProfile", profileId: demoId(`tourist-profile:${number}`),
    });
    add("TouristProfile", `tourist-profile:${number}`, { user: user._id }, {
      user: user._id, fullName: `Demo Traveler ${number}`, preferredCurrency: "EGP",
    });
    return user;
  });
  const guides = new Map(destinations.map(destination => {
    const email = `guide.${destination.key}@demo.example.com`;
    const user = add("User", `guide:${destination.key}`, { email, role: "guide" }, {
      email, password: passwordHashes.guide, role: "guide", status: "active",
      authProviders: ["local"], emailVerified: true,
      roleProfile: "GuideProfile", profileId: demoId(`guide-profile:${destination.key}`),
    });
    const profile = add("GuideProfile", `guide-profile:${destination.key}`, { user: user._id }, {
      user: user._id, fullName: `Demo Guide - ${destination.name}`,
      verificationStatus: "approved", identityStatus: "approved", headline: "Fictional portfolio guide - demonstration only",
      about: `${DEMO_NOTICE} The approved state is a demo fixture, not evidence of identity verification.`,
      location: `${destination.name}, Egypt`, languages: ["English", "Arabic"],
      specialties: ["History & Culture"], rating: 0, reviewsCount: 0,
    });
    return [destination.key, { user, profile }];
  }));

  experiences.forEach(([key, title, city, price, hours, category, description], index) => {
    const destination = destinations.find(item => item.key === city);
    const { user: guide, profile } = guides.get(city);
    const endTime = `${String(9 + hours).padStart(2, "0")}:00`;
    const capacity = city === "siwa" ? 6 : 8;
    const schedule = demoSchedule(key, hours, capacity, now);
    const trip = add("Trip", `trip:${key}`, { guide: guide._id }, {
      title, description: `${description} ${DEMO_NOTICE}`, longDescription: `${description}\n\n${DEMO_NOTICE}`,
      guide: guide._id, location: `${destination.name}, Egypt`, coordinates: { lat: destination.lat, lng: destination.lng },
      price, currency: "EGP", duration: `${hours} hours`, category, status: "active", groupSize: capacity,
      lifecycleStatus: "live", reviewStatus: "approved", publishedVersion: 1,
      featured: FEATURED_DEMO_TRIPS.includes(key),
      image: DEMO_MEDIA[city], gallery: [DEMO_MEDIA[city]], schedule,
      highlights: [{ title: "Small-group demo", text: "One account reserves one seat. Test bookings only." }],
      rating: 0, reviewsCount: 0, reviews: [],
    });
    const tourist = tourists[index % tourists.length];
    const pastDate = dateKey(now, -14 - index);
    const start = occurrenceDateTime(pastDate, "09:00");
    const end = occurrenceDateTime(pastDate, endTime);
    const booking = add("Booking", `booking:${key}`, { trip: trip._id, tourist: tourist._id, guide: guide._id, bookingSource: "seed" }, {
      trip: trip._id, tourist: tourist._id, guide: guide._id, bookingSource: "seed",
      occurrenceKey: `${pastDate}::demo-history-${key}`, slotDate: pastDate, date: start, endAt: end,
      timeSlot: `09:00 - ${endTime}`, numberOfGuests: 1, pricePerPerson: price, totalPrice: price,
      currency: "EGP", platformFee: 0, guideEarnings: 0, status: "completed", completedAt: end,
      paymentStatus: "unpaid", paymentProvider: "none", paymentMethod: "none",
      paymentReference: "", paymobIntentionId: "", paymobOrderId: "", paymobTransactionId: "", paymobClientSecret: "",
      specialRequests: [DEMO_NOTICE], holdExpiresAt: null,
    });
    const rating = index % 3 === 0 ? 4 : 5;
    const comment = `${DEMO_NOTICE} Sample feedback describing the pacing and itinerary for ${title}.`;
    add("Review", `review:${key}`, { booking: booking._id, trip: trip._id, tourist: tourist._id, guide: guide._id }, {
      booking: booking._id, trip: trip._id, tourist: tourist._id, guide: guide._id,
      rating, title: "Demo review - fictional feedback", comment, isVerifiedBooking: false, isVisible: true, moderationStatus:'published', provenance:'demo',
      createdAt: new Date(end.getTime() + 60 * 60 * 1000),
    });
    trip.rating = 0;
    trip.reviewsCount = 0;
    trip.reviews = [{ name: `Demo Traveler ${index % 3 + 1}`, date: pastDate, text: comment, rating }];
    profile.rating = 0;
    profile.reviewsCount = 0;
  });
  return rows;
}
