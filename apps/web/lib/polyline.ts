// Descodifica o formato "encoded polyline" do Google, que é o que o Strava
// usa em activities.route_polyline (map.summary_polyline na API). Algoritmo
// standard — sem dependências, ~20 linhas, não vale a pena um pacote só
// para isto.
//
// Referência: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = Math.pow(10, precision);
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += decodeValue();
    lng += decodeValue();
    coordinates.push([lat / factor, lng / factor]);
  }

  function decodeValue(): number {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }

  return coordinates;
}
