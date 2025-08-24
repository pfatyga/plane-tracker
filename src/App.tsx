import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { Marker as LeafletMarker, DivIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Plane type definition
interface Plane {
  hex: string;
  flight: string;
  lat: number;
  lon: number;
  altitude: number;
  track: number;
  speed: number;
  active: boolean;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in km
}

function getScaleFromAltitude(altitude: number): number {
  // normalize between 0.5x (ground) and 2x (40,000 ft)
  const minAlt = 0;
  const maxAlt = 40000;
  const minScale = 0.5;
  const maxScale = 2.0;

  const clamped = Math.max(minAlt, Math.min(maxAlt, altitude));
  return minScale + ((clamped - minAlt) / (maxAlt - minAlt)) * (maxScale - minScale);
}


// Custom plane icon (SVG) that can rotate
const planeIcon = (track: number, altitude: number, active: boolean, selected: boolean) => {
  const scale = getScaleFromAltitude(altitude);

  return L.divIcon({
    className: "plane-icon",
    html: `
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24"
           width="24" height="24"
           stroke=${selected ? "yellow" : ""} stroke-width="2"
           fill=${active ? "blue" : "gray"}
           style="transform: rotate(${track}deg) scale(${scale}); transform-origin: center;">
        <path d="M2 16.5l9-4.5V3.5c0-.83.67-1.5 1.5-1.5S14 2.67 14 3.5v8.5l9 4.5v2l-9-2v4l2 1.5v1h-8v-1l2-1.5v-4l-9 2v-2z"/>
      </svg>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12], // rotate around center
  });
}

const userIcon = new DivIcon({
  html: `<div class="pulse"></div>`,
  className: "", // prevent Leaflet default styles
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Animated Marker wrapper
function AnimatedMarker({ plane, onClick, home, selectedFlight }: { plane: Plane; onClick: () => void, home: [number, number] | null, selectedFlight: string | null }) {
  const markerRef = useRef<LeafletMarker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(planeIcon(plane.track, plane.altitude, plane.active, selectedFlight === plane.flight.trim()));
      markerRef.current.setLatLng([plane.lat, plane.lon]);
    }
  }, [plane]);

  return (
    <Marker
      ref={markerRef}
      position={[plane.lat, plane.lon]}
      icon={planeIcon(plane.track, plane.altitude, plane.active, selectedFlight === plane.flight.trim()) as DivIcon}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div>
          <div><b>Active:</b> {plane.active ? "true" : "false"}</div>
          <div><b>Flight:</b> {plane.flight || "N/A"}</div>
          <div><b>Altitude:</b> {plane.altitude} ft</div>
          <div><b>Speed:</b> {plane.speed} kts</div>
          {home && (
            <div>
              <b>Distance from me:</b>{" "}
              {haversineDistance(
                home[0],
                home[1],
                plane.lat,
                plane.lon
              ).toFixed(1)} km
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function App() {
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [planeTrails, setPlaneTrails] = useState<Record<string, [number, number][]>>({});
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
  // const [flightDetails, setFlightDetails] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [updateInterval, setUpdateInterval] = useState<number>(500);
  const mapRef = useRef<any>(null);

  // Handler to change update frequency
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value >= 100) {
      setUpdateInterval(value);
    }
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          console.error("Error getting location:", err);
        }
      );
    }
  }, []);

  // Poll server every 5 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8080/data.json");
        const data: Plane[] = await res.json();

        setPlanes((prevPlanes) => {
          const dataHexSet = new Set(data.map(p => p.hex));
          const planeMap = new Map(prevPlanes.map(p => [p.hex, p]));

          // Update or add planes from new data
          data.forEach((plane) => {
            planeMap.set(plane.hex, { ...plane, active: true });
          });

          // Mark planes not in new data as inactive
          planeMap.forEach((plane, hex) => {
            if (!dataHexSet.has(hex)) {
              planeMap.set(hex, { ...plane, active: false });
            }
          });

          return Array.from(planeMap.values());
        });

        // Update trails
        setPlaneTrails((prev) => {
          const updated: Record<string, [number, number][]> = { ...prev };
          data.forEach((plane) => {
            const key = plane.hex;
            const newPoint: [number, number] = [plane.lat, plane.lon];

            if (!updated[key]) updated[key] = [];
            const trail = [...updated[key], newPoint];

            // keep last 20 positions
            updated[key] = trail;
          });
          return updated;
        });
      } catch (err) {
        console.error("Error fetching plane data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, updateInterval);
    return () => clearInterval(interval);
  }, [updateInterval]);

  // // Fetch extra flight details
  // useEffect(() => {
  //   if (!selectedFlight) return;

  //   const fetchFlightDetails = async () => {
  //     try {
  //       const res = await fetch(`https://api.example.com/flight/${selectedFlight}`);
  //       const details = await res.json();
  //       setFlightDetails(details);
  //     } catch (err) {
  //       console.error("Error fetching flight details:", err);
  //       setFlightDetails(null);
  //     }
  //   };

  //   fetchFlightDetails();
  // }, [selectedFlight]);

  // UI control for update frequency
  const updateFrequencyControl = (
    <div className="absolute top-4 left-4 bg-white p-2 rounded shadow-md">
      <label>
        Update frequency (ms):{" "}
        <input
          type="number"
          min={100}
          step={100}
          value={updateInterval}
          onChange={handleIntervalChange}
          className="border rounded px-2 py-1 w-24"
        />
      </label>
    </div>
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }} className="w-full h-screen">
      {/* {updateFrequencyControl} */}

      <MapContainer
        center={[39.9, -75.1]}
        zoom={8}
        className="w-full h-full"
        style={{ width: "100vw", height: "100vh" }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        />

        {planes.map((plane) => (
          <>
            {planeTrails[plane.hex] && (
              <Polyline
                key={`trail-${plane.hex}-${plane.active ? "active" : "inactive"}`}
                positions={planeTrails[plane.hex]}
                color={plane.active ? "blue" : "gray"}
                weight={2}
              />
            )}

            <AnimatedMarker
              key={plane.hex}
              plane={plane}
              home={userLocation}
              selectedFlight={selectedFlight}
              onClick={() => {
                setSelectedFlight(plane.flight.trim());
                // setFlightDetails(null);
              }}
            />
          </>
        ))}

        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>

      {selectedFlight && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-md w-64">
          <h2 className="font-bold">Flight: {selectedFlight}</h2>
          {/* {flightDetails ? (
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(flightDetails, null, 2)}
            </pre>
          ) : (
            <p>Loading details...</p>
          )} */}
        </div>
      )}

      <div className="sidebar">
        <h2>Flights Seen</h2>
        <ul>
          {Array.from(planes.values()).sort((a: Plane, b: Plane) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            // sort by distance from user
            if (userLocation) {
              const distA = haversineDistance(userLocation[0], userLocation[1], a.lat, a.lon);
              const distB = haversineDistance(userLocation[0], userLocation[1], b.lat, b.lon);
              return distA - distB;
            }
            return 0;
          }).map((plane) => (
            <li
              key={plane.hex}
              className={`${plane.active ? 'active' : 'inactive'}`}
              onClick={() => {
                // fly map to plane when clicked
                if (mapRef.current) {
                  mapRef.current.setView([plane.lat, plane.lon], 10);
                  setSelectedFlight(plane.flight.trim());
                }
              }}
            >
              ✈️ {plane.flight?.trim() || "Unknown"} - {plane.active ? "Active" : "Out of range"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}