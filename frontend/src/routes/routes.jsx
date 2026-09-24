import Operations from '../pages/Marketplace/Operations';
import { Navigate, createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import RequireApprovedGuide from "./RequireApprovedGuide";

import AuthLayout from "../shared/AuthLayout/AuthLayout";
import MasterLayout from "../shared/MasterLayout/MasterLayout";
import NotFound from "../shared/NotFound/NotFound";

import Welcome from "../pages/Auth/Welcome/Welcome";
import Login from "../pages/Auth/components/Login/Login";
import Register from "../pages/Auth/components/Register/Register";
import Forgetpassword from "../pages/Auth/components/Forgetpassword/Forgetpassword";
import ResetPassword from "../pages/Auth/components/ResetPassword/ResetPassword";
import ApplicationReceived from "../pages/Auth/components/ApplicationReceived/ApplicationReceived";
import CheckEmail from "../pages/Auth/Onboarding/CheckEmail";
import ChooseRole from "../pages/Auth/Onboarding/ChooseRole";
import LinkGoogleAccount from "../pages/Auth/Onboarding/LinkGoogleAccount";
import VerifyEmail from "../pages/Auth/Onboarding/VerifyEmail";

import Home from "../pages/User/Home/Home";
import Info from "../pages/User/Trips/Info/Info";
import Book from "../pages/User/Trips/Book/Book";
import Status from "../pages/User/Trips/Book/components/Status/Status";
import Guide from "../pages/User/Trips/Guide/Guide";
import Saved from "../pages/User/Saved/Saved";
import Profile from "../pages/User/Profile/Profile";
import ProfileOverview from "../pages/User/Profile/pages/ProfileOverview/ProfileOverview";
import EditProfile from "../pages/User/Profile/pages/EditProfile/EditProfile";
import ChangePassword from "../pages/User/Profile/pages/ChangePassword/ChangePassword";
import MyBookings from "../pages/User/Profile/pages/MyBookings/MyBookings";
import PaymentMethods from "../pages/User/Profile/pages/PaymentMethods/PaymentMethods";
import ReviewsWritten from "../pages/User/Profile/pages/ReviewsWritten/ReviewsWritten";
import HelpSupport from "../pages/User/Profile/pages/HelpSupport/HelpSupport";
import Settings from "../pages/User/Settings/Settings";
import NotificationsPage from "../pages/User/Notifications/NotificationsPage";
import NearbyMap from "../pages/User/NearbyMap/NearbyMap";
import RecommendedTrips from "../pages/User/RecommendedTrips/RecommendedTrips";

import Admin from "../pages/Admin/Admin";
import DashboardStatus from "../pages/Admin/pages/DashboardStatus/DashboardStatus";
import Accounts from "../pages/Admin/pages/Accounts/Accounts";
import CMS from "../pages/Admin/pages/CMS/CMS";
import Analytics from "../pages/Admin/pages/Analytics/Analytics";
import Booking from "../pages/Admin/pages/Booking/Booking";
import AdminOperations from "../pages/Admin/pages/AdminOperations/AdminOperations";

import ToursManagement from "../pages/Guide/ToursManagement/ToursManagement";
import CreateTour from "../pages/Guide/CreateTour/CreateTour";
import Schedule from "../pages/Guide/Schedule/Schedule";
import TourMedia from "../pages/Guide/TourMedia/TourMedia";
import TourApprove from "../pages/Guide/TourApprove/TourApprove";
import GuidePortalLayout from "../pages/Guide/components/GuidePortalLayout/GuidePortalLayout";
import GuideDashboard from "../pages/Guide/GuideDashboard/GuideDashboard";
import GuideCalendar from "../pages/Guide/GuideCalendar/GuideCalendar";
import GuideBookings from "../pages/Guide/GuideBookings/GuideBookings";
import GuideEarnings from "../pages/Guide/GuideEarnings/GuideEarnings";
import GuideAccountProfile from "../pages/Guide/GuideAccountProfile/GuideAccountProfile";
import GuideNotifications from "../pages/Guide/GuideNotifications/GuideNotifications";
import GuideVerification from "../pages/Guide/GuideVerification/GuideVerification";
import GuideApplicationReceived from "../pages/Guide/GuideApplicationReceived/GuideApplicationReceived";
import GuideOperations from "../pages/Guide/GuideOperations/GuideOperations";
import GuideReviews from "../pages/Guide/GuideReviews/GuideReviews";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Welcome />,
    errorElement: <NotFound />,
  },
  {
    path: "auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "application-received", element: <ApplicationReceived /> },
      { path: "forget-password", element: <Forgetpassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "check-email", element: <CheckEmail /> },
      { path: "choose-role", element: <ChooseRole /> },
      { path: "link-google", element: <LinkGoogleAccount /> },
      { path: "verify-email", element: <VerifyEmail /> },
    ],
  },
  {
    element: <MasterLayout />,
    children: [
      { path: "explore", element: <Home /> },
      { path: "nearby", element: <NearbyMap /> },
      {
        path: "trips",
        children: [
          { index: true, element: <RecommendedTrips /> },
          {
            path: ":id",
            children: [
              { index: true, element: <Info /> },
              { path: "guide", element: <Guide /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "user",
    element: <ProtectedRoute allowedRoles={["tourist", "guide"]} />,
    children: [
      {
        element: <MasterLayout />,
        children: [
          { index: true, element: <Navigate to="/explore" replace /> },
          { path: "home", element: <Navigate to="/explore" replace /> },
          { path: "nearby", element: <Navigate to="/nearby" replace /> },
          {
            path: "trips",
            children: [
              { index: true, element: <Navigate to="/trips" replace /> },
              {
                path: ":id",
                children: [
                  { index: true, element: <Info /> },
                  { path: "book", element: <Book /> },
                  { path: "book/status", element: <Status /> },
                  { path: "guide", element: <Guide /> },
                ],
              },
            ],
          },
          { path: "saved", element: <Saved /> },
          {
            path: "profile",
            element: <Profile />,
            children: [
              { index: true, element: <ProfileOverview /> },
              { path: "edit", element: <EditProfile /> },
              { path: "change-password", element: <ChangePassword /> },
              { path: "bookings", element: <MyBookings /> },
              { path: "payments", element: <PaymentMethods /> },
              { path: "reviews", element: <ReviewsWritten /> },
              { path: "support", element: <HelpSupport /> },
            ],
          },
          { path: "settings", element: <Settings /> },
          {path:"experience-support",element:<Operations role="tourist"/>},
          { path: "notifications", element: <NotificationsPage /> },
        ],
      },
    ],
  },
  {
    path: "guide",
    children: [
      {
        element: <ProtectedRoute allowedRoles={["guide"]} />,
        children: [
          {
            element: <RequireApprovedGuide />,
            children: [
              {
                element: <GuidePortalLayout />,
                children: [
                  { index: true, element: <ToursManagement /> },
                  { path: "dashboard", element: <GuideDashboard /> },
                  { path: "operations", element: <GuideOperations /> },
                  { path: "calendar", element: <GuideCalendar /> },
                  { path: "bookings", element: <GuideBookings /> },
                  { path: "reviews", element: <GuideReviews /> },
                  { path: "earnings", element: <GuideEarnings /> },
                  { path: "profile", element: <GuideAccountProfile /> },
                  { path: "notifications", element: <GuideNotifications /> },
                ],
              },
              // Refresh-safe tour setup URLs. The older state-based routes stay below
              // for backward compatibility with any saved links during the migration.
              { path: "tours/new", element: <CreateTour /> },
              { path: "tours/:tripId/edit", element: <CreateTour /> },
              { path: "tours/:tripId/schedule", element: <Schedule /> },
              { path: "tours/:tripId/media", element: <TourMedia /> },
              { path: "tours/:tripId/submit", element: <TourApprove /> },
              { path: "createtour", element: <CreateTour /> },
              { path: "schedule", element: <Schedule /> },
              { path: "tourmedia", element: <TourMedia /> },
              { path: "tourapprove", element: <TourApprove /> },
            ],
          },
          {
            element: <GuidePortalLayout />,
            children: [
              { path: "verification", element: <GuideVerification /> },
              { path: "application-received", element: <GuideApplicationReceived /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "admin",
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        element: <Admin />,
        children: [
          { index: true, element: <Navigate to="/admin/overview" replace /> },
          { path: "overview", element: <DashboardStatus /> },
          { path: "accounts", element: <Accounts /> },
          { path: "operations", element: <AdminOperations /> },
          { path: "cms", element: <CMS /> },
          { path: "analytics", element: <Analytics /> },
          { path: "booking", element: <Booking /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
