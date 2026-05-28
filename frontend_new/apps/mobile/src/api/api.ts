import { createApiServices } from "@hazard-hero/shared";
import apiClient from "./client";

export const {
  authAPI,
  devicesAPI,
  deviceClaimsAPI,
  notificationAPI,
  pushTokenAPI,
  sitesAPI,
} = createApiServices(apiClient);
