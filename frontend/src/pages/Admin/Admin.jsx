import { Outlet } from "react-router-dom";

import AdminErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import Navbar from "./components/Navbar/Navbar";
import SideBar from "./components/Sidebar/Sidebar";
import styles from "./Admin.module.css";

export default function Admin() {
  return (
    <div className={styles.dashboard}>
      <aside className={styles.sidebar}><SideBar /></aside>
      <div className={styles.body}>
        <div className={styles.navbar}><Navbar /></div>
        <main className={styles.page}>
          <AdminErrorBoundary><Outlet /></AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}
