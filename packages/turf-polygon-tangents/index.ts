import type {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  Position,
  MultiPolygon,
} from "geojson";
import type { Coord } from "@turf/helpers";
import { getCoords, getType } from "@turf/invariant";
import { point, featureCollection } from "@turf/helpers";
import { bbox as calcBbox } from "@turf/bbox";
import { explode } from "@turf/explode";
import { nearestPoint } from "@turf/nearest-point";

/**
 * Finds the tangents of a {@link Polygon|(Multi)Polygon} from a {@link Point}.
 *
 * @function
 * @param {Coord} pt to calculate the tangent points from
 * @param {Feature<Polygon|MultiPolygon>} polygon to get tangents from
 * @returns {FeatureCollection<Point>} Feature Collection containing the two tangent points
 * @example
 * var polygon = turf.polygon([[[11, 0], [22, 4], [31, 0], [31, 11], [21, 15], [11, 11], [11, 0]]]);
 * var point = turf.point([61, 5]);
 *
 * var tangents = turf.polygonTangents(point, polygon)
 *
 * //addToMap
 * var addToMap = [tangents, point, polygon];
 */
function polygonTangents<T extends Polygon | MultiPolygon>(
  pt: Coord,
  polygon: Feature<T> | T
): FeatureCollection<Point> {
  const pointCoords = getCoords(pt);
  const polyCoords = getCoords(polygon);

  let rtan: Position = [];
  let ltan: Position = [];
  let eprev: number;
  const bbox = calcBbox(polygon);
  let nearestPtIndex = 0;
  let nearest = null;

  // If the point lies inside the polygon bbox then we need to be a bit trickier
  // otherwise points lying inside reflex angles on concave polys can have issues
  if (
    pointCoords[0] > bbox[0] &&
    pointCoords[0] < bbox[2] &&
    pointCoords[1] > bbox[1] &&
    pointCoords[1] < bbox[3]
  ) {
    nearest = nearestPoint(pt, explode(polygon));
    nearestPtIndex = nearest.properties.featureIndex;
  }
  const type = getType(polygon);
  switch (type) {
    case "Polygon":
      rtan = polyCoords[0][nearestPtIndex];
      ltan = polyCoords[0][0];
      if (nearest !== null) {
        if (nearest.geometry.coordinates[1] < pointCoords[1])
          ltan = polyCoords[0][nearestPtIndex];
      }
      eprev = isLeft(
        polyCoords[0][0],
        polyCoords[0][polyCoords[0].length - 1],
        pointCoords
      );
      [rtan, ltan] = processPolygon(
        polyCoords[0],
        pointCoords,
        eprev,
        rtan,
        ltan
      );
      break;
    case "MultiPolygon":
      var closestFeature = 0;
      var closestVertex = 0;
      var verticesCounted = 0;
      for (var i = 0; i < polyCoords[0].length; i++) {
        closestFeature = i;
        var verticeFound = false;
        for (var i2 = 0; i2 < polyCoords[0][i].length; i2++) {
          closestVertex = i2;
          if (verticesCounted === nearestPtIndex) {
            verticeFound = true;
            break;
          }
          verticesCounted++;
        }
        if (verticeFound) break;
      }
      rtan = polyCoords[0][closestFeature][closestVertex];
      ltan = polyCoords[0][closestFeature][closestVertex];
      eprev = isLeft(
        polyCoords[0][0][0],
        polyCoords[0][0][polyCoords[0][0].length - 1],
        pointCoords
      );
      polyCoords.forEach(function (ring) {
        [rtan, ltan] = processPolygon(ring[0], pointCoords, eprev, rtan, ltan);
      });
      break;
  }
  return featureCollection([point(rtan), point(ltan)]);
}

function processPolygon(
  polygonCoords: Position[],
  ptCoords: Position,
  eprev: number,
  rtan: Position,
  ltan: Position
) {
  for (let i = 0; i < polygonCoords.length; i++) {
    const currentCoords = polygonCoords[i];
    let nextCoordPair = polygonCoords[i + 1];
    if (i === polygonCoords.length - 1) {
      nextCoordPair = polygonCoords[0];
    }
    const enext = isLeft(currentCoords, nextCoordPair, ptCoords);
    if (eprev <= 0 && enext > 0) {
      if (!isBelow(ptCoords, currentCoords, rtan)) {
        rtan = currentCoords;
      }
    } else if (eprev > 0 && enext <= 0) {
      if (!isAbove(ptCoords, currentCoords, ltan)) {
        ltan = currentCoords;
      }
    }
    eprev = enext;
  }
  return [rtan, ltan];
}

function isAbove(point1: Position, point2: Position, point3: Position) {
  return isLeft(point1, point2, point3) > 0;
}

function isBelow(point1: Position, point2: Position, point3: Position) {
  return isLeft(point1, point2, point3) < 0;
}

function isLeft(point1: Position, point2: Position, point3: Position) {
  return (
    (point2[0] - point1[0]) * (point3[1] - point1[1]) -
    (point3[0] - point1[0]) * (point2[1] - point1[1])
  );
}

export { polygonTangents };
export default polygonTangents;
