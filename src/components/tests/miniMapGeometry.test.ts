import { describe, expect, it } from "vitest"
import { createMapGeometry } from "../createMapGeometry"

describe("map framing", () => {
  it("aligns a static map center with its route overlay and leaves room for pins", () => {
    const points = [
      { lat: 55.95, lon: -3.206 },
      { lat: 55.951, lon: -3.205 },
    ]
    const map = createMapGeometry({
      you: points[0],
      markers: points,
      radiusMeters: 0,
      width: 640,
      height: 300,
      padding: 48,
    })
    expect(map.center.lon).toBeCloseTo(-3.2055, 5)
    expect(map.toLocal(map.center).x).toBeCloseTo(320, 5)
    expect(map.toLocal(map.center).y).toBeCloseTo(150, 5)
    for (const point of points) {
      expect(map.toLocal(point).x).toBeGreaterThanOrEqual(48)
      expect(map.toLocal(point).x).toBeLessThanOrEqual(592)
      expect(map.toLocal(point).y).toBeGreaterThanOrEqual(48)
      expect(map.toLocal(point).y).toBeLessThanOrEqual(252)
    }
  })
  it.each([200, 500, 1000])("fits a %im search on a mobile map", radiusMeters => {
    const map = createMapGeometry({
      you: { lat: 55.95, lon: -3.19 },
      markers: [],
      radiusMeters,
      width: 320,
      height: 200,
    })
    expect(map.you.x - map.radius).toBeGreaterThanOrEqual(18)
    expect(map.you.y - map.radius).toBeGreaterThanOrEqual(18)
    expect(map.you.y + map.radius).toBeLessThanOrEqual(182)
  })
  it("keeps markers across the date line nearby and wraps tile URLs", () => {
    const map = createMapGeometry({
      you: { lat: 0, lon: 179.999 },
      markers: [{ lat: 0, lon: -179.999 }],
      radiusMeters: 500,
      width: 320,
      height: 200,
    })
    expect(Math.abs(map.toLocal({ lat: 0, lon: -179.999 }).x - map.you.x)).toBeLessThan(100)
    expect(map.tiles.every(tile => tile.x >= 0 && tile.x < 2 ** map.zoom)).toBe(true)
  })
  it.each([-90, 90])("keeps polar coordinates finite at %i", lat => {
    const map = createMapGeometry({
      you: { lat, lon: 0 },
      markers: [],
      radiusMeters: 1000,
      width: 320,
      height: 200,
    })
    expect(Number.isFinite(map.you.y)).toBe(true)
    expect(Number.isFinite(map.radius)).toBe(true)
    expect(map.tiles.every(tile => tile.y >= 0 && tile.y < 2 ** map.zoom)).toBe(true)
  })
  it("includes distant markers and supplied GPS accuracy", () => {
    const map = createMapGeometry({
      you: { lat: 55, lon: 0 },
      markers: [{ lat: 55.02, lon: 0.03 }],
      radiusMeters: 200,
      accuracyMeters: 700,
      width: 320,
      height: 200,
    })
    const marker = map.toLocal({ lat: 55.02, lon: 0.03 })
    expect(marker.x).toBeLessThanOrEqual(302)
    expect(marker.y).toBeGreaterThanOrEqual(18)
    expect(map.you.y + map.accuracy).toBeLessThanOrEqual(182)
  })
})
