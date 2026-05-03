import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  className?: string;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function LocationMarker({ position, setPosition }: { position: L.LatLngExpression, setPosition: (pos: L.LatLng) => void }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function LocationPicker({ initialLat = -17.8252, initialLng = 31.0335, onLocationSelect, className }: LocationPickerProps) {
  const [position, setPosition] = useState<L.LatLng>(new L.LatLng(initialLat, initialLng));
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
          setPosition(newPos);
          setIsLocating(false);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setIsLocating(false);
        }
      );
    } else {
      setIsLocating(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // Using Nominatim for a basic free geocoding fallback
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        setPosition(new L.LatLng(parseFloat(result.lat), parseFloat(result.lon)));
        if (!address) setAddress(result.display_name);
      }
    } catch (err) {
      console.error("Searching failed:", err);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative group">
        <MapPin size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-primary transition-colors" />
        <textarea
          placeholder="Business Physical Address (e.g. 123 Samora Machel Ave, Harare)"
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all font-medium text-sm min-h-[80px]"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-white/10 h-64 shadow-inner">
        <MapContainer 
          center={[position.lat, position.lng]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
          <MapUpdater center={[position.lat, position.lng]} />
        </MapContainer>

        {/* Overlay Controls */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <button 
            type="button"
            onClick={handleGetCurrentLocation}
            className="w-10 h-10 bg-[#0d1117]/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-primary shadow-lg hover:bg-primary hover:text-black transition-all"
            title="Scan GPS"
          >
            {isLocating ? <Loader2 className="animate-spin" size={20} /> : <Crosshair size={20} />}
          </button>
        </div>

        <form 
          onSubmit={handleManualSearch}
          className="absolute bottom-4 left-4 right-4 z-[1000]"
        >
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              placeholder="Search Area or City..."
              className="w-full bg-[#0d1117]/90 backdrop-blur-md border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-gray-600 outline-none focus:border-primary/50 shadow-2xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>
      </div>

      <button
        type="button"
        onClick={() => onLocationSelect(position.lat, position.lng, address)}
        className="w-full py-4 bg-primary/20 text-primary border border-primary/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        <MapPin size={14} /> Validate & Sync Coordinates
      </button>
    </div>
  );
}
