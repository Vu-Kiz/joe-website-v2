import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  // Fail loudly during dev if someone forgets the env
  // (in prod you might want something less noisy)
  console.error("VITE_API_BASE_URL is not defined");
}

export const api = axios.create({
  baseURL, // e.g. http://66.23.202.2:9011/api
  // You can add headers, timeouts, etc here later
});
