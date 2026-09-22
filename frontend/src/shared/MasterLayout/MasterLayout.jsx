import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet } from "react-router-dom";

import { fetchNotifications } from "@/store/slices/notificationSlice";
import PremiumNavbar from "./PremiumNavbar";
import PremiumBottomNav from "./PremiumBottomNav";

export default function MasterLayout() {
  const dispatch = useDispatch();
  const { initialized, isAuthenticated } = useSelector((state) => state.auth || {});

  useEffect(() => {
    if (!initialized || !isAuthenticated) return;
    dispatch(fetchNotifications());
  }, [dispatch, initialized, isAuthenticated]);

  return (
    <div>
      <PremiumNavbar />
      <Outlet />
      <PremiumBottomNav />
    </div>
  );
}
