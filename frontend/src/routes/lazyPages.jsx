import { lazy } from "react";

export const Operations = lazy(() => import("../pages/Marketplace/Operations"));

export const Login = lazy(() => import("../pages/Auth/components/Login/Login"));
export const Register = lazy(() => import("../pages/Auth/components/Register/Register"));
export const Forgetpassword = lazy(() => import("../pages/Auth/components/Forgetpassword/Forgetpassword"));
export const ResetPassword = lazy(() => import("../pages/Auth/components/ResetPassword/ResetPassword"));
export const ApplicationReceived = lazy(() => import("../pages/Auth/components/ApplicationReceived/ApplicationReceived"));
export const CheckEmail = lazy(() => import("../pages/Auth/Onboarding/CheckEmail"));
export const ChooseRole = lazy(() => import("../pages/Auth/Onboarding/ChooseRole"));
export const LinkGoogleAccount = lazy(() => import("../pages/Auth/Onboarding/LinkGoogleAccount"));
export const VerifyEmail = lazy(() => import("../pages/Auth/Onboarding/VerifyEmail"));

export const Home = lazy(() => import("../pages/User/Home/Home"));
export const Info = lazy(() => import("../pages/User/Trips/Info/Info"));
export const Book = lazy(() => import("../pages/User/Trips/Book/Book"));
export const Status = lazy(() => import("../pages/User/Trips/Book/components/Status/Status"));
export const Guide = lazy(() => import("../pages/User/Trips/Guide/Guide"));
export const Saved = lazy(() => import("../pages/User/Saved/Saved"));
export const Profile = lazy(() => import("../pages/User/Profile/Profile"));
export const ProfileOverview = lazy(() => import("../pages/User/Profile/pages/ProfileOverview/ProfileOverview"));
export const EditProfile = lazy(() => import("../pages/User/Profile/pages/EditProfile/EditProfile"));
export const ChangePassword = lazy(() => import("../pages/User/Profile/pages/ChangePassword/ChangePassword"));
export const MyBookings = lazy(() => import("../pages/User/Profile/pages/MyBookings/MyBookings"));
export const PaymentMethods = lazy(() => import("../pages/User/Profile/pages/PaymentMethods/PaymentMethods"));
export const ReviewsWritten = lazy(() => import("../pages/User/Profile/pages/ReviewsWritten/ReviewsWritten"));
export const HelpSupport = lazy(() => import("../pages/User/Profile/pages/HelpSupport/HelpSupport"));
export const Settings = lazy(() => import("../pages/User/Settings/Settings"));
export const NotificationsPage = lazy(() => import("../pages/User/Notifications/NotificationsPage"));
export const NearbyMap = lazy(() => import("../pages/User/NearbyMap/NearbyMap"));
export const RecommendedTrips = lazy(() => import("../pages/User/RecommendedTrips/RecommendedTrips"));

export const Admin = lazy(() => import("../pages/Admin/Admin"));
export const DashboardStatus = lazy(() => import("../pages/Admin/pages/DashboardStatus/DashboardStatus"));
export const Accounts = lazy(() => import("../pages/Admin/pages/Accounts/Accounts"));
export const CMS = lazy(() => import("../pages/Admin/pages/CMS/CMS"));
export const Analytics = lazy(() => import("../pages/Admin/pages/Analytics/Analytics"));
export const Booking = lazy(() => import("../pages/Admin/pages/Booking/Booking"));
export const AdminOperations = lazy(() => import("../pages/Admin/pages/AdminOperations/AdminOperations"));

export const ToursManagement = lazy(() => import("../pages/Guide/ToursManagement/ToursManagement"));
export const CreateTour = lazy(() => import("../pages/Guide/CreateTour/CreateTour"));
export const Schedule = lazy(() => import("../pages/Guide/Schedule/Schedule"));
export const TourMedia = lazy(() => import("../pages/Guide/TourMedia/TourMedia"));
export const TourApprove = lazy(() => import("../pages/Guide/TourApprove/TourApprove"));
export const GuidePortalLayout = lazy(() => import("../pages/Guide/components/GuidePortalLayout/GuidePortalLayout"));
export const GuideDashboard = lazy(() => import("../pages/Guide/GuideDashboard/GuideDashboard"));
export const GuideCalendar = lazy(() => import("../pages/Guide/GuideCalendar/GuideCalendar"));
export const GuideBookings = lazy(() => import("../pages/Guide/GuideBookings/GuideBookings"));
export const GuideEarnings = lazy(() => import("../pages/Guide/GuideEarnings/GuideEarnings"));
export const GuideAccountProfile = lazy(() => import("../pages/Guide/GuideAccountProfile/GuideAccountProfile"));
export const GuideNotifications = lazy(() => import("../pages/Guide/GuideNotifications/GuideNotifications"));
export const GuideVerification = lazy(() => import("../pages/Guide/GuideVerification/GuideVerification"));
export const GuideApplicationReceived = lazy(() => import("../pages/Guide/GuideApplicationReceived/GuideApplicationReceived"));
export const GuideOperations = lazy(() => import("../pages/Guide/GuideOperations/GuideOperations"));
export const GuideReviews = lazy(() => import("../pages/Guide/GuideReviews/GuideReviews"));
