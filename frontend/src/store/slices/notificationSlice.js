import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { apiRequest } from "../../services/api";

const normalizeNotification = (notification) => ({
  ...notification,
  id: notification.id || notification._id,
});

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async () => {
    const response = await apiRequest("/notifications?limit=100");
    return {
      notifications: (response.data?.notifications || []).map(normalizeNotification),
      unreadCount: response.meta?.unreadCount || 0,
    };
  },
);

export const markAsRead = createAsyncThunk(
  "notifications/markAsRead",
  async (notificationId) => {
    await apiRequest(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
    return notificationId;
  },
);

export const markAllAsRead = createAsyncThunk(
  "notifications/markAllAsRead",
  async () => {
    await apiRequest("/notifications/read-all", { method: "PATCH" });
  },
);

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
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
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Unable to load notifications";
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find((item) => item.id === action.payload);
        if (notification && !notification.isRead) {
          notification.isRead = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach((notification) => {
          notification.isRead = true;
        });
        state.unreadCount = 0;
      });
  },
});

export const { clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
