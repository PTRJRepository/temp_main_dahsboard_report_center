import axios from "axios";

// ponytail: relative paths work both via proxy (/upah) and direct (:8002). No extra base config needed.
export async function fetchDowntimeKpi(token, { month, year } = {}) {
  const params = {};
  if (month) params.month = String(month);
  if (year) params.year = String(year);
  const { data } = await axios.get("downtime/kpi", { params, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return data;
}
export async function fetchDowntimeBoard(token) {
  const { data } = await axios.get("downtime/board", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return data;
}
export async function fetchDowntimeEvents(token, filter = {}) {
  const { data } = await axios.get("downtime/events", { params: filter, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return data;
}
export async function fetchAssetHealthList(token, filter = {}) {
  const { data } = await axios.get("asset-health/assets", { params: filter, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return data;
}
export async function fetchAssetHealth(token, id) {
  const { data } = await axios.get(`asset-health/assets/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return data;
}
export async function fetchDowntimeTimeline(token, id) {
  const { data } = await axios.get(`downtime/events/${encodeURIComponent(id)}/timeline`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return data;
}
