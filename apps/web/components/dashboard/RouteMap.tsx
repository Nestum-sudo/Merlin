"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  coordinates: [number, number][]; // [lat, lng]
}

// OpenStreetMap — sem chave de API, sem custo. Só é carregado no cliente
// (ver o dynamic import com ssr:false em DashboardView) porque o Leaflet
// precisa de `window`.
export default function RouteMap({ coordinates }: Props) {
  if (coordinates.length === 0) return null;

  const bounds: [[number, number], [number, number]] = [
    [Math.min(...coordinates.map((c) => c[0])), Math.min(...coordinates.map((c) => c[1]))],
    [Math.max(...coordinates.map((c) => c[0])), Math.max(...coordinates.map((c) => c[1]))],
  ];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [16, 16] }}
      style={{ height: 220, width: "100%", borderRadius: 2 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={coordinates} pathOptions={{ color: "#D4FF3F", weight: 3 }} />
      <CircleMarker center={coordinates[0]} radius={5} pathOptions={{ color: "#4FA8D8", fillColor: "#4FA8D8", fillOpacity: 1 }} />
      <CircleMarker center={coordinates[coordinates.length - 1]} radius={5} pathOptions={{ color: "#C9622B", fillColor: "#C9622B", fillOpacity: 1 }} />
    </MapContainer>
  );
}
