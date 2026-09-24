import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { apiRequest } from "../../services/api";

const normalizeNotification = (notification) => ({
  ...notification,
  id: notification.id || notification._id,
});

const FETCH_COOLDOWN_MS = 10_000;

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async (options = {}) => {
    const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 100);
    const response = await apiRequest(`/notifications?limit=${limit}`);
    return {
      notifications: (response.data?.notifications || []).map(normalizeNotification),
      unreadCount: response.meta?.unreadCount || 0,
      syncedAt: new Date().toISOString(),
    };
  },
  {
    condition: (options = {}, { getState }) => {
      const notifications = getState().notifications;
      if (notifications.loading) return false;
      if (options.force) return true;
      if (!notifications.lastSyncedAt) return true;

      return (
        Date.now() - new Date(notifications.lastSyncedAt).getTime() >=
        FETCH_COOLDOWN_MS
      );
    },
  },
);

export const markAsRead = createAsyncThunk(
  "notifications/markAsRead",
  async (notificationId) => {
    const response = await apiRequest(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
    return {
      id: notificationId,
      readAt:
        response.data?.notification?.readAt || new Date().toISOString(),
    };
  },
);

export const markAllAsRead = createAsyncThunk(
  "notifications/markAllAsRead",
  async () => {
    await apiRequest("/notifications/read-all", { method: "PATCH" });
    return { readAt: new Date().toISOString() };
  },
);

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  actionError: null,
  lastSyncedAt: null,
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.loading = false;
      state.error = null;
      state.actionError = null;
      state.lastSyncedAt = null;
    },
    clearNotificationActionError: (state) => {
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
        state.lastSyncedAt = action.payload.syncedAt;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Unable to load notifications";
      })
      .addCase(markAsRead.pending, (state) => {
        state.actionError = null;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(
          (item) => item.id === action.payload.id,
        );
        if (notification && !notification.isRead) {
          notification.isRead = true;
          notification.readAt = action.payload.readAt;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAsRead.rejected, (state, action) => {
        state.actionError =
          action.error.message || "Unable to mark notification as read";
      })
      .addCase(markAllAsRead.pending, (state) => {
        state.actionError = null;
      })
      .addCase(markAllAsRead.fulfilled, (state, action) => {
        state.notifications.forEach((notification) => {
          notification.isRead = true;
          notification.readAt = notification.readAt || action.payload.readAt;
        });
        state.unreadCount = 0;
      })
      .addCase(markAllAsRead.rejected, (state, action) => {
        state.actionError =
          action.error.message || "Unable to mark notifications as read";
      });
  },
});

export const {
  clearNotificationActionError,
  clearNotifications,
} = notificationSlice.actions;
export default notificationSlice.reducer;
