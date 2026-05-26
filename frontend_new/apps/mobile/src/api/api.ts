import { createApiServices } from "@hazard-hero/shared";
import apiClient from "./client";

export const {
  authAPI,
  organizationAPI,
  notificationAPI,
  pushTokenAPI,
  devicesAPI,
  deviceClaimsAPI,
  sitesAPI,
} = createApiServices(apiClient);
