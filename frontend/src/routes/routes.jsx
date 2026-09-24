import { Navigate, createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import RequireApprovedGuide from "./RequireApprovedGuide";

import AuthLayout from "../shared/AuthLayout/AuthLayout";
import MasterLayout from "../shared/MasterLayout/MasterLayout";
import NotFound from "../shared/NotFound/NotFound";

import Welcome from "../pages/Auth/Welcome/Welcome";

import {
  Accounts,
  Admin,
  AdminOperations,
  Analytics,
  ApplicationReceived,
  Book,
  Booking,
  ChangePassword,
  CheckEmail,
  ChooseRole,
  CMS,
  CreateTour,
  DashboardStatus,
  EditProfile,
  Forgetpassword,
  Guide,
  GuideAccountProfile,
  GuideApplicationReceived,
  GuideBookings,
  GuideCalendar,
  GuideDashboard,
  GuideEarnings,
  GuideNotifications,
  GuideOperations,
  GuidePortalLayout,
  GuideReviews,
  GuideVerification,
  HelpSupport,
  Home,
  Info,
  LinkGoogleAccount,
  Login,
  MyBookings,
  NearbyMap,
  NotificationsPage,
  Operations,
  PaymentMethods,
  Profile,
  ProfileOverview,
  RecommendedTrips,
  Register,
  ResetPassword,
  ReviewsWritten,
  Saved,
  Schedule,
  Settings,
  Status,
  TourApprove,
  TourMedia,
  ToursManagement,
  VerifyEmail,
} from "./lazyPages";

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
