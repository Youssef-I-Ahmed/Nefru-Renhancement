import ExperienceCard from "../ExperienceCard/ExperienceCard";

function RecommendedTourCard({
  _id,
  image,
  badge,
  title,
  location,
  duration,
  rating,
  reviewsCount,
  guide,
  price,
  category,
  groupSize,
  currency = "USD",
}) {
  return (
    <ExperienceCard
      id={_id}
      image={image}
      badge={badge}
      category={category}
      title={title}
      location={location}
      duration={duration}
      rating={rating}
      reviewsCount={reviewsCount}
      guide={guide}
      groupSize={groupSize}
      price={price}
      currency={currency}
    />
  );
}

export default RecommendedTourCard;
