import { getTimeAndDateMoonData } from "../services/timeAndDateMoonService.js";
import { send } from "../services/responseService.js";

export async function handleTimeAndDateMoon(request, response, url) {
  const latitude = Number(url.searchParams.get("latitude"));
  const longitude = Number(url.searchParams.get("longitude"));
  const data = await getTimeAndDateMoonData({
    locationName: url.searchParams.get("locationName"),
    country: url.searchParams.get("country"),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    date: url.searchParams.get("date")
  });

  send(response, data.ok ? 200 : 202, data);
}
