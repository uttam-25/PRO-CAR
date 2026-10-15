import axios from 'axios';

const BASE_URL = 'http://10.0.2.2:5000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Log errors via interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error?.response?.status, error?.config?.url, error?.message);
    return Promise.reject(error);
  }
);

export const createInspection = (vehicleModel, customerName) =>
  apiClient.post('/api/inspections', { vehicleModel, customerName });

export const listInspections = () =>
  apiClient.get('/api/inspections');

export const getInspection = (id) =>
  apiClient.get(`/api/inspections/${id}`);

export const uploadBeforeMedia = (id, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', {
      uri: file.uri,
      name: file.name || `before_${Date.now()}.${file.type === 'video' ? 'mp4' : 'jpg'}`,
      type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
  });
  return apiClient.post(`/api/inspections/${id}/before-media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const startReturn = (id) =>
  apiClient.post(`/api/inspections/${id}/return`);

export const uploadAfterMedia = (id, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', {
      uri: file.uri,
      name: file.name || `after_${Date.now()}.${file.type === 'video' ? 'mp4' : 'jpg'}`,
      type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
  });
  return apiClient.post(`/api/inspections/${id}/after-media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const compareMedia = (id) =>
  apiClient.post(`/api/inspections/${id}/compare`);

export const getReport = (id) =>
  apiClient.get(`/api/inspections/${id}/report`);

export { BASE_URL };
