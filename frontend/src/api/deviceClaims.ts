import {
  ClaimValidateRequest,
  ClaimValidateResponse,
  ClaimRequest,
  ClaimResponse,
} from '../types/device';
import apiClient from './client';

export const deviceClaimsAPI = {
  validate: async (request: ClaimValidateRequest): Promise<ClaimValidateResponse> => {
    const response = await apiClient.post<ClaimValidateResponse>('/device-claims/validate', request);
    return response;
  },

  claim: async (request: ClaimRequest): Promise<ClaimResponse> => {
    const response = await apiClient.post<ClaimResponse>('/device-claims/claim', request);
    return response;
  },
};
