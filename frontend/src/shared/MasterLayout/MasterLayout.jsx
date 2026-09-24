import { Outlet } from "react-router-dom";
import PremiumNavbar from "./PremiumNavbar";
import PremiumBottomNav from "./PremiumBottomNav";

export default function MasterLayout() {
  return (
    <div>
      <PremiumNavbar />
      <Outlet />
      <PremiumBottomNav />
    </div>
  );
}
