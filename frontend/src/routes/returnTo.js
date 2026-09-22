export function getSafeReturnTo(location) {
  const returnTo = `${location.pathname || "/"}${location.search || ""}${location.hash || ""}`;
  return returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/user/home";
}
