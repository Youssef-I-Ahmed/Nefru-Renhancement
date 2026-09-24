import { Outlet, useLocation } from "react-router-dom";
import PremiumNavbar from "./PremiumNavbar";
import PremiumBottomNav from "./PremiumBottomNav";

export default function MasterLayout() {
  const { pathname } = useLocation();

  const hideBottomNav =
    pathname === "/nearby" ||
    /^\/user\/trips\/[^/]+\/book(?:\/status)?$/.test(pathname);

  return (
    <div>
      <PremiumNavbar />
      <Outlet />
      <PremiumBottomNav hidden={hideBottomNav} />
    </div>
  );
}
