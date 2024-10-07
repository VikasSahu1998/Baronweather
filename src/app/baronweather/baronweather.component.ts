import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { ApiService } from '../shared/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-baronweather',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './baronweather.component.html',
  styleUrls: ['./baronweather.component.scss']
})
export class BaronweatherComponent implements OnInit {
  private map: any;
  public weatherData: any[] = [];
  notamData: any;
  public isTafVisible = false; // Track visibility of TAFs
  TafData: any;
  public isNotamVisible = false; // Track visibility of NOTAMs
  private markers: L.Marker[] = []; // To keep track of markers for clearing them
  public isMetarVisible = false; // Public property to track visibility

  private weatherIconMap: { [key: string]: string } = {
    "9000": "velocityweather_icons/condition-9000-large-day.png", // Clear
    "9001": "velocityweather_icons/condition-9001-large-day.png", // Sunny
    "9002": "velocityweather_icons/condition-9002-large-day.png", // Mostly Clear
    "9003": "velocityweather_icons/condition-9003-large-day.png", // Partly Cloudy
    "9004": "velocityweather_icons/condition-9004-large-day.png", // Mostly Cloudy
    "9005": "velocityweather_icons/condition-9005-large-day.png", // Cloudy
    "0002": "velocityweather_icons/condition-0002-large-day.png", // Haze
    "0003": "velocityweather_icons/condition-0003-large-day.png", // Fog
    "0004": "velocityweather_icons/condition-0004-large-day.png", // Dust
    "0005": "velocityweather_icons/condition-0005-large-day.png", // Smoke
    "0006": "velocityweather_icons/condition-0006-large-day.png", // Frost
    "0011": "velocityweather_icons/condition-0011-large-day.png", // Blowing Snow
    "0012": "velocityweather_icons/condition-0012-large-day.png", // Drizzle
    "0013": "velocityweather_icons/condition-0013-large-day.png", // Rain Showers
    "0014": "velocityweather_icons/condition-0014-large-day.png", // Rain
    "0016": "velocityweather_icons/condition-0016-large-day.png", // Snow Showers
    "0017": "velocityweather_icons/condition-0017-large-day.png", // Snow
    "0018": "velocityweather_icons/condition-0018-large-day.png", // Sleet
    "0019": "velocityweather_icons/condition-0019-large-day.png", // Freezing Drizzle
    "0020": "velocityweather_icons/condition-0020-large-day.png", // Freezing Rain
    "0021": "velocityweather_icons/condition-0021-large-day.png", // Thunderstorms
    "0022": "velocityweather_icons/condition-0022-large-day.png", // Rain and Thunderstorms
    "0023": "velocityweather_icons/condition-0023-large-day.png", // Showers and Thunderstorms
    "0024": "velocityweather_icons/condition-0024-large-day.png", // Rain and Snow
    "0025": "velocityweather_icons/condition-0025-large-day.png", // Rain and Snow Showers
    "0026": "velocityweather_icons/condition-0026-large-day.png", // Rain and Sleet
    "0027": "velocityweather_icons/condition-0027-large-day.png", // Snow and Sleet
    "0028": "velocityweather_icons/condition-0028-large-day.png", // Freezing Drizzle and Rain
    "0029": "velocityweather_icons/condition-0029-large-day.png", // Freezing Rain and Rain
    "0030": "velocityweather_icons/condition-0030-large-day.png", // Freezing Rain and Sleet
    "2012": "velocityweather_icons/condition-2012-large-day.png", // Chance of Drizzle
    "2013": "velocityweather_icons/condition-2013-large-day.png", // Chance of Rain Showers
    "2014": "velocityweather_icons/condition-2014-large-day.png", // Chance of Rain
    "2016": "velocityweather_icons/condition-2016-large-day.png", // Chance of Snow Showers
    "2017": "velocityweather_icons/condition-2017-large-day.png", // Chance of Snow
    "2018": "velocityweather_icons/condition-2018-large-day.png", // Chance of Sleet
    "2019": "velocityweather_icons/condition-2019-large-day.png", // Chance of Freezing Drizzle
    "2020": "velocityweather_icons/condition-2020-large-day.png", // Chance of Freezing Rain
    "2021": "velocityweather_icons/condition-2021-large-day.png", // Chance of Thunderstorms
    "2022": "velocityweather_icons/condition-2022-large-day.png", // Chance of Rain and Thunderstorms
    "2023": "velocityweather_icons/condition-2023-large-day.png", // Chance of Showers and Thunderstorms
    "2024": "velocityweather_icons/condition-2024-large-day.png", // Chance of Rain and Snow
    "2025": "velocityweather_icons/condition-2025-large-day.png", // Chance of Rain and Snow Showers
    "2026": "velocityweather_icons/condition-2026-large-day.png", // Chance of Rain and Sleet
    "2027": "velocityweather_icons/condition-2027-large-day.png", // Chance of Snow and Sleet
    "2028": "velocityweather_icons/condition-2028-large-day.png", // Chance of Freezing Drizzle and Rain
    "2029": "velocityweather_icons/condition-2029-large-day.png", // Chance of Freezing Rain and Rain
    "2030": "velocityweather_icons/condition-2030-large-day.png", // Chance of Freezing Rain and Sleet
    "9100": "velocityweather_icons/condition-9100-large-day.png", // Windy
    "9101": "velocityweather_icons/condition-9101-large-day.png", // Humid
    "9102": "velocityweather_icons/condition-9102-large-day.png", // Dry
    "9103": "velocityweather_icons/condition-9103-large-day.png", // Freezing
    "9104": "velocityweather_icons/condition-9104-large-day.png", // Very Hot
    "9105": "velocityweather_icons/condition-9105-large-day.png", // Very Cold
    "9106": "velocityweather_icons/condition-9106-large-day.png", // Becoming Warmer
    "9107": "velocityweather_icons/condition-9107-large-day.png", // Becoming Colder
    "9200": "velocityweather_icons/condition-9200-large-day.png", // Mixed Precipitation
    "9201": "velocityweather_icons/condition-9201-large-day.png", // Thunderstorms and Frozen Precipitation
    "9999": "velocityweather_icons/condition-9999-large-day.png", // Unknown
  };

  // A fallback icon for unknown weather conditions
  private fallbackIcon = "velocityweather_icons/condition-9999-large-day.png"; // Default icon for unknown conditions

  constructor(private weatherService: ApiService) { }

  ngOnInit(): void {
    this.fetchTafData();
  }

  private initMap(): void {
    this.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.5937, 78.9629], 4);

    const streets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    });

    const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {});
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {});
    const navigation = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    });
    const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });
    const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });
    const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    const baseMaps = {
      'Streets': streets,
      'Satellite': satellite,
      'Navigation': navigation,
      'Hybrid': googleHybrid,
      'Satellite Google': googleSat,
      'Terrain': googleTerrain,
      'Dark': darkMatter
    };
    const overlayMaps = {};

    // Create and add watermark control
    const WatermarkControl = L.Control.extend({
      onAdd: function () {
        const img = L.DomUtil.create('img');
        img.src = 'https://www.cognitivenavigation.com/wp-content/uploads/2024/03/cropped-C_Name.png'; // Replace with your watermark image URL
        img.style.width = '100px';
        img.style.opacity = '1'; // Adjust transparency
        img.style.display = 'block';
        return img;
      }
    });
    // Add the watermark control to the map
    new WatermarkControl({ position: 'bottomright' }).addTo(this.map);

    L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(this.map);
    streets.addTo(this.map);
    // L.control.scale({ position: 'bottomright', metric: false }).addTo(this.map);
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // Event to capture the map view change
    this.map.on('moveend', () => {
      const center = this.map.getCenter();

      // Only fetch if METAR is visible
      if (this.isMetarVisible) {
        this.fetchWeatherData(center.lat, center.lng);
      }

      if (this.isNotamVisible) { this.fetchNotamData(); }
      if (this.isTafVisible) { this.fetchTafData(); }
    });

  }

  ngAfterViewInit(): void {
    this.initMap();

    const initialCenter = this.map.getCenter();
    if (this.isMetarVisible) { // Initial fetch if METAR is visible
      this.fetchWeatherData(initialCenter.lat, initialCenter.lng);
    }
  }

  // New method to toggle METAR visibility
  public toggleMetarDisplay(): void {
    this.isMetarVisible = !this.isMetarVisible; // Toggle the flag
    if (this.isMetarVisible) {
      const center = this.map.getCenter();
      this.fetchWeatherData(center.lat, center.lng); // Fetch weather data when turning on
    } else {
      this.removeWeatherMarkers(); // Clear markers when turning off
    }
  }

  private removeWeatherMarkers(): void {
    // Remove all existing weather markers
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
    });
    this.weatherData = []; // Clear the weather data array
  }

  private fetchWeatherData(lat: number, lon: number): void {
    this.weatherService.getWeatherData(lat, lon).subscribe(
      (data: any) => {
        if (data?.metars?.data) {
          this.weatherData = [data.metars.data]; // Wrap it in an array if only one station is returned
          this.addWeatherMarkers(); // Add weather markers when data is received
        }
      },
      (error) => {
        console.error('Error fetching weather data:', error);
      }
    );
  }

  private addWeatherMarkers(): void {
    this.weatherData.forEach(weather => {
      const station = weather.station;

      // Ensure coordinates contain exactly 2 elements (latitude, longitude)
      if (station.coordinates && station.coordinates.length === 2) {
        const latLng: L.LatLngTuple = [station.coordinates[1], station.coordinates[0]]; // Leaflet expects [latitude, longitude]

        // Extract weather data from the API response
        const temperature = weather.temperature?.value ?? 'N/A';
        const feelsLike = weather.temperature?.wet_bulb ?? 'N/A'; // Using wet bulb as "feels like"
        const dewPoint = weather.temperature?.dew_point ?? 'N/A';
        const wind = weather.wind ? `${weather.wind.speed} m/s at ${weather.wind.dir}°` : 'N/A';
        const humidity = weather.relative_humidity?.value ?? 'N/A';
        const skyConditions = weather.weather_code?.text ?? 'N/A';
        const visibility = weather.visibility ? `${(weather.visibility.value / 1000).toFixed(1)} km` : 'N/A'; // Convert meters to kilometers
        const rawMetar = weather.raw_metar ?? 'N/A'; // Raw METAR data
        const weatherCode = weather.weather_code.value; // Get the weather code
        const iconUrl = this.weatherIconMap[weatherCode] || this.fallbackIcon; // Get the icon URL

        // Construct a popup content with weather details
        const popupContent = `
        <h3>${station.name} (${station.id})</h3>
        <p><strong>Temperature:</strong> ${temperature}°C</p>
        <p><strong>Feels Like:</strong> ${feelsLike}°C</p>
        <p><strong>Dew Point:</strong> ${dewPoint}°C</p>
        <p><strong>Wind:</strong> ${wind}</p>
        <p><strong>Relative Humidity:</strong> ${humidity}%</p>
        <p><strong>Sky Conditions:</strong> ${skyConditions}</p>
        <p><strong>Visibility:</strong> ${visibility}</p>
        <p><strong>Raw Metar:</strong> ${rawMetar}</p>
      `;


        // Create a custom icon
        const weatherIcon = L.icon({
          iconUrl: iconUrl,
          iconSize: [32, 32], // Size of the icon
          iconAnchor: [16, 32], // Point of the icon which will correspond to marker's location
          popupAnchor: [0, -32] // Point from which the popup should open relative to the iconAnchor
        });

        // Add a marker at the weather station's coordinates
        const marker = L.marker(latLng, { icon: weatherIcon })
          .addTo(this.map)
          .bindPopup(popupContent);
      } else {
        console.warn(`Station ${station.id} has invalid coordinates:`, station.coordinates);
      }
    });
  }

  // Toggle function for NOTAM visibility
  public toggleNotamDisplay(): void {
    this.isNotamVisible = !this.isNotamVisible; // Toggle the flag

    if (this.isNotamVisible) {
      this.fetchNotamData(); // Fetch NOTAM data when turning on
    } else {
      this.clearMarkers(); // Clear markers when turning off
    }
  }

  private fetchNotamData(): void {
    if (!this.map) {
      console.error('Map is not initialized yet.');
      return; // Exit if the map is not initialized
    }

    const bounds = this.map.getBounds(); // Get the bounds of the map
    const nLat = bounds.getNorth(); // Get the northern latitude
    const sLat = bounds.getSouth(); // Get the southern latitude
    const wLon = bounds.getWest();  // Get the western longitude
    const eLon = bounds.getEast();  // Get the eastern longitude

    this.weatherService.getNotamData(nLat, sLat, wLon, eLon).subscribe(
      data => {
        this.notamData = data.notams.data;

        // Clear existing markers before adding new ones
        this.clearMarkers();

        // Add markers for each NOTAM if the toggle is on
        if (this.isNotamVisible) {
          this.addNotamMarkers(this.notamData);
        }
      },
      error => {
        console.error('Error fetching NOTAM data:', error);
      }
    );
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker); // Remove the marker from the map
    });
    this.markers = []; // Clear the markers array
  }

  private addNotamMarkers(notamData: any[]): void {
    // Iterate over each NOTAM entry
    notamData.forEach(notamEntry => {
      const station = notamEntry.station;

      // Ensure coordinates contain exactly 2 elements (latitude, longitude)
      if (station.coordinates && station.coordinates.length === 2) {
        const latLng: L.LatLngTuple = [station.coordinates[1], station.coordinates[0]]; // Leaflet expects [latitude, longitude]

        // Iterate over each NOTAM in the entry
        notamEntry.notams.forEach((notam: any) => {
          // Extract relevant NOTAM details
          const notamId = notam.id;
          const rawText = notam.raw_text;
          const issueTime = new Date(notam.issuetime).toLocaleString(); // Format issue time
          const validBegin = notam.valid_begin === "WIE" ? "When In Effect" : new Date(notam.valid_begin).toLocaleString();
          const validEnd = notam.valid_end === "UFN" ? "Until Further Notice" : new Date(notam.valid_end).toLocaleString();

          // Construct popup content with NOTAM details
          const popupContent = `
          <h3>NOTAM ID: ${notamId}</h3>
          <p><strong>Issued:</strong> ${issueTime}</p>
          <p><strong>Valid From:</strong> ${validBegin}</p>
          <p><strong>Valid Until:</strong> ${validEnd}</p>
          <p><strong>Details:</strong> ${rawText}</p>
        `;

          // Create a custom icon
          const customIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', // Base64 image string
            iconSize: [32, 32], // Size of the icon
            iconAnchor: [16, 32], // Point of the icon which will correspond to marker's location
            popupAnchor: [0, -32] // Point from which the popup should open relative to the iconAnchor
          });

          // Add a marker at the station's coordinates
          const marker = L.marker(latLng, { icon: customIcon })
            .addTo(this.map)
            .bindPopup(popupContent);

          // Store the marker for future reference
          this.markers.push(marker);
        });
      } else {
        console.warn(`Station ${station.id} has invalid coordinates:`, station.coordinates);
      }
    });
  }

  // Toggle function for TAF visibility
  public toggleTafDisplay(): void {
    this.isTafVisible = !this.isTafVisible; // Toggle the flag

    if (this.isTafVisible) {
      this.fetchTafData(); // Fetch TAF data when turning on
    } else {
      this.clearTafMarkers(); // Clear markers when turning off
    }
  }
  private fetchTafData(): void {
    if (!this.map) {
      console.error('Map is not initialized yet.');
      return; // Exit if the map is not initialized
    }

    const bounds = this.map.getBounds(); // Get the bounds of the map
    const nLat = bounds.getNorth(); // Get the northern latitude
    const sLat = bounds.getSouth(); // Get the southern latitude
    const wLon = bounds.getWest();  // Get the western longitude
    const eLon = bounds.getEast();  // Get the eastern longitude

    this.weatherService.getTafData(nLat, sLat, wLon, eLon).subscribe(
      data => {
        this.TafData = data.tafs.data;

        // Clear existing markers before adding new ones
        this.clearMarkers(); // You can replace this with a specific clear function for TAF if you want

        // Add markers for each TAF if the toggle is on
        if (this.isTafVisible) {
          this.addTafMarkers(this.TafData);
        }
      },
      error => {
        console.error('Error fetching TAF data:', error);
      }
    );
  }
  private addTafMarkers(tafData: any[]): void {
    tafData.forEach(tafEntry => {
      const station = tafEntry.station;

      // Ensure coordinates contain exactly 2 elements (latitude, longitude)
      if (station.coordinates && station.coordinates.length === 2) {
        const latLng: L.LatLngTuple = [station.coordinates[1], station.coordinates[0]]; // Note the order: [lat, lng]

        // Extract relevant TAF details
        const tafId = station.id;
        const rawText = tafEntry.raw_text;
        const issueTime = new Date(tafEntry.issuetime).toLocaleString(); // Format issue time
        const validBegin = new Date(tafEntry.valid_begin).toLocaleString();
        const validEnd = tafEntry.valid_end === "UFN" ? "Until Further Notice" : new Date(tafEntry.valid_end).toLocaleString();

        // Construct popup content with TAF details
        const popupContent = `
        <h3>TAF ID: ${tafId}</h3>
        <p><strong>Issued:</strong> ${issueTime}</p>
        <p><strong>Valid From:</strong> ${validBegin}</p>
        <p><strong>Valid Until:</strong> ${validEnd}</p>
        <p><strong>Details:</strong> ${rawText}</p>
      `;

        // Create a custom icon for TAF
        const customIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });

        // Add a marker at the station's coordinates
        const marker = L.marker(latLng, { icon: customIcon })
          .addTo(this.map)
          .bindPopup(popupContent);

        // Store the marker for future reference (optional)
        this.markers.push(marker); // Or use a specific array for TAF markers if desired

      } else {
        console.warn(`Station ${station.id} has invalid coordinates:`, station.coordinates);
      }
    });
  }
  private clearTafMarkers(): void {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker); // Remove the marker from the map
    });
    this.markers = []; // Clear the markers array (or use a specific array for TAF if separate)
  }

}