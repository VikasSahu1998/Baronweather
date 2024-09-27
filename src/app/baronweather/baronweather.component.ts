import { Component } from '@angular/core';
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
export class BaronweatherComponent {
  private map: any;
  public weatherData: any[] = [];

  constructor(private weatherService: ApiService) {}

  private initMap(): void {
    this.map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 4);

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

    L.control.layers(baseMaps, overlayMaps, { position: 'topleft' }).addTo(this.map);
    streets.addTo(this.map);
    L.control.scale({ position: 'bottomleft', metric: false }).addTo(this.map);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.fetchWeatherData();
  }

  private fetchWeatherData(): void {
    this.weatherService.getWeatherData().subscribe(
      (data: any) => {
        if (data?.metars?.data) {
          this.weatherData = data.metars.data;
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

        // Extract weather data with proper fallback
        const temperature = weather.temperature?.value ?? 'N/A';
        const feelsLike = weather.feels_like ?? temperature; // Fallback to temperature if feels_like is not provided
        const dewPoint = weather.temperature?.dew_point ?? 'N/A';
        const windSpeed = weather.wind?.speed ?? 'N/A';
        const windDir = weather.wind?.dir ?? 'N/A';
        const windUnits = weather.wind?.speed_units ?? 'N/A';
        const relativeHumidity = weather.relative_humidity?.value ?? 'N/A';
        const pressure = weather.pressure?.sea_level ?? 'N/A';
        const visibility = weather.visibility?.value ?? 'N/A';
        const rawMetar = weather.raw_metar ?? 'N/A';

        // Construct a popup content with weather details
        const popupContent = `
          <h3>${station.name} (${station.id})</h3>
          <p><strong>Temperature:</strong> ${temperature}°C</p>
          <p><strong>Feels Like:</strong> ${feelsLike}°C</p>
          <p><strong>Dew Point:</strong> ${dewPoint}°C</p>
          <p><strong>Relative Humidity:</strong> ${relativeHumidity}%</p>
          <p><strong>Wind:</strong> ${windSpeed} ${windUnits} (Direction: ${windDir}°)</p>
          <p><strong>Pressure:</strong> ${pressure} hPa</p>
          <p><strong>Visibility:</strong> ${visibility} km</p>
          <p><strong>Raw METAR:</strong> ${rawMetar}</p>
        `;

        // Add a marker at the weather station's coordinates
        const marker = L.marker(latLng)
          .addTo(this.map)
          .bindPopup(popupContent);
        
        // Remove the automatic opening of the popup
        // marker.openPopup();  // This line is removed to prevent the popup from opening by default.
      } else {
        console.warn(`Station ${station.id} has invalid coordinates:`, station.coordinates);
      }
    });
  }
}
