import ExperienceCard from "../ExperienceCard/ExperienceCard";

const TourCard = ({
  image,
  location,
  nights,
  duration,
  title,
  price,
  id,
  rating,
  reviewsCount,
  guide,
  category,
  groupSize,
  currency = "USD",
}) => (
  <ExperienceCard
    id={id}
    image={image}
    location={location}
    duration={duration || nights}
    title={title}
    price={price}
    rating={rating}
    reviewsCount={reviewsCount}
    guide={guide}
    category={category}
    groupSize={groupSize}
    currency={currency}
  />
);

export default TourCard;
