import type { Location } from "../types"

/** Read the browser's current position without inventing a street-level label. */
export function locateBrowser(
  /** Browser geolocation, injected for deterministic permission and accuracy checks. */
  geolocation = navigator.geolocation,
): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new Error("Location is unavailable. Enter a street or landmark instead."))
      return
    }
    geolocation.getCurrentPosition(
      position => {
        const { latitude: lat, longitude: lon, accuracy } = position.coords
        if (
          ![lat, lon, accuracy].every(Number.isFinite) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180 ||
          accuracy < 0
        ) {
          reject(new Error("Location is unavailable. Enter a street or landmark instead."))
          return
        }
        resolve({
          name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          area: "Current position",
          coordinates: { lat, lon },
          accuracyMeters: accuracy,
        })
      },
      error =>
        reject(
          new Error(
            error.code === 1
              ? "Location access was denied. Enter a street or landmark instead."
              : "Location is unavailable. Enter a street or landmark instead.",
          ),
        ),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    )
  })
}
