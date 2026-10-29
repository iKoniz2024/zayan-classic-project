import axios from "axios";
import { getApiUrl } from "./getApiUrl";

const axiosPublic = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosPublic.interceptors.request.use((config) => {
  config.baseURL = getApiUrl();
  return config;
});

export default axiosPublic;
