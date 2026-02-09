// src/api/client.ts
import axios, { type AxiosInstance } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  console.error("VITE_API_BASE_URL is not defined");
}

export const api: AxiosInstance = axios.create({
  baseURL, // e.g. http://66.23.202.2:9011/api
});

// 👇 add this line
export default api;
